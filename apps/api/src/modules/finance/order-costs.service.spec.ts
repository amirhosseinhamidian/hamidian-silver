import { OrderCostEntryType, PaymentRefundStatus } from '../../generated/prisma/enums';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import { OrderCostsService } from './order-costs.service';

describe('OrderCostsService', () => {
  const actorUserId = '10000000-0000-4000-8000-000000000001';
  const orderId = '20000000-0000-4000-8000-000000000001';
  const costId = '30000000-0000-4000-8000-000000000001';

  it('creates a positive immutable cost entry only for an order with a finance snapshot', async () => {
    const transaction = {
      order: {
        findUnique: jest.fn().mockResolvedValue({
          id: orderId,
          financeSnapshot: {
            id: '40000000-0000-4000-8000-000000000001',
          },
        }),
      },
      orderCostEntry: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: costId,
          amountToman: 25_000,
        }),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    };
    const service = new OrderCostsService(prisma as unknown as PrismaService);

    await service.create(actorUserId, {
      orderId,
      type: OrderCostEntryType.PAYMENT_GATEWAY_FEE,
      amountToman: 25_000,
      source: 'zarinpal',
      externalReference: 'REF-001',
      idempotencyKey: 'gateway-fee-001',
    });

    expect(transaction.orderCostEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orderId,
        type: OrderCostEntryType.PAYMENT_GATEWAY_FEE,
        amountToman: 25_000,
        source: 'zarinpal',
        externalReference: 'REF-001',
        idempotencyKey: 'gateway-fee-001',
        createdByUserId: actorUserId,
        occurredAt: expect.any(Date),
      }),
      include: expect.any(Object),
    });
  });

  it('reverses a cost by appending one negative ledger entry', async () => {
    const transaction = {
      orderCostEntry: {
        findUnique: jest.fn().mockResolvedValue({
          id: costId,
          orderId,
          type: OrderCostEntryType.SHIPPING_PROVIDER,
          amountToman: 80_000,
          source: 'postex',
          externalReference: 'PX-001',
          reversalOfId: null,
          reversal: null,
        }),
        create: jest.fn().mockResolvedValue({
          id: '50000000-0000-4000-8000-000000000001',
          amountToman: -80_000,
          reversalOfId: costId,
        }),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    };
    const service = new OrderCostsService(prisma as unknown as PrismaService);

    await service.reverse(costId, actorUserId, {
      reason: 'Provider invoice was cancelled.',
    });

    expect(transaction.orderCostEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orderId,
        type: OrderCostEntryType.SHIPPING_PROVIDER,
        amountToman: -80_000,
        source: 'postex',
        idempotencyKey: `reverse:${costId}`,
        reversalOfId: costId,
        createdByUserId: actorUserId,
      }),
      include: expect.any(Object),
    });
  });

  it('reverses a zero actual-cost marker so reconciliation can reopen', async () => {
    const transaction = {
      orderCostEntry: {
        findUnique: jest.fn().mockResolvedValue({
          id: costId,
          orderId,
          type: OrderCostEntryType.PAYMENT_GATEWAY_FEE,
          amountToman: 0,
          source: 'zarinpal',
          externalReference: 'REF-ZERO',
          reversalOfId: null,
          reversal: null,
        }),
        create: jest.fn().mockResolvedValue({
          id: '50000000-0000-4000-8000-000000000099',
          amountToman: 0,
          reversalOfId: costId,
        }),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    };
    const service = new OrderCostsService(prisma as unknown as PrismaService);

    await service.reverse(costId, actorUserId, {
      reason: 'Zero marker was recorded before the final provider fee arrived.',
    });

    expect(transaction.orderCostEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orderId,
        type: OrderCostEntryType.PAYMENT_GATEWAY_FEE,
        amountToman: 0,
        source: 'zarinpal',
        idempotencyKey: `reverse:${costId}`,
        reversalOfId: costId,
        createdByUserId: actorUserId,
      }),
      include: expect.any(Object),
    });
  });

  it('calculates per-order contribution from net cost entries and confirmed refunds', async () => {
    const prisma = {
      orderFinanceSnapshot: {
        findUnique: jest.fn().mockResolvedValue({
          paidAt: new Date('2026-08-30T12:00:00.000Z'),
          grossMarginBeforeServiceCostsToman: 900_000,
          order: {
            id: orderId,
            orderNumber: 'HS-TEST',
            status: 'DELIVERED',
          },
        }),
      },
      orderCostEntry: {
        groupBy: jest.fn().mockResolvedValue([
          {
            type: OrderCostEntryType.PAYMENT_GATEWAY_FEE,
            _sum: { amountToman: 30_000 },
            _count: { _all: 1 },
          },
          {
            type: OrderCostEntryType.SHIPPING_PROVIDER,
            _sum: { amountToman: 70_000 },
            _count: { _all: 2 },
          },
          {
            type: OrderCostEntryType.PLATING_SERVICE,
            _sum: { amountToman: 50_000 },
            _count: { _all: 1 },
          },
        ]),
      },
      paymentRefund: {
        aggregate: jest.fn().mockResolvedValue({
          _sum: { amountToman: 100_000 },
          _count: { _all: 1 },
        }),
      },
    };
    const service = new OrderCostsService(prisma as unknown as PrismaService);

    await expect(service.contribution(orderId)).resolves.toEqual(
      expect.objectContaining({
        grossMarginBeforeServiceCostsToman: 900_000,
        paymentGatewayFeeToman: 30_000,
        shippingProviderCostToman: 70_000,
        platingServiceCostToman: 50_000,
        operatingServiceCostToman: 150_000,
        confirmedRefundToman: 100_000,
        contributionMarginToman: 750_000,
        contributionAfterRefundsToman: 650_000,
      }),
    );

    expect(prisma.paymentRefund.aggregate).toHaveBeenCalledWith({
      where: {
        status: PaymentRefundStatus.CONFIRMED,
        payment: {
          orderId,
        },
      },
      _sum: {
        amountToman: true,
      },
      _count: {
        _all: true,
      },
    });
  });
});
