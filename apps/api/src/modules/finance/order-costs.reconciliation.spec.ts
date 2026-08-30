import { OrderCostEntryType, PaymentAttemptStatus } from '../../generated/prisma/enums';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import { OrderCostsService } from './order-costs.service';

describe('OrderCostsService reconciliation', () => {
  const orderId = '10000000-0000-4000-8000-000000000001';

  it('flags only actual-cost categories that have operational evidence but no ledger entry', async () => {
    const order = {
      id: orderId,
      orderNumber: 'HS-047',
      status: 'DELIVERED',
      paidAt: new Date('2026-08-30T10:00:00.000Z'),
      platingTotalToman: 120_000,
      financeSnapshot: {
        id: '20000000-0000-4000-8000-000000000001',
      },
      payment: {
        attempts: [
          {
            id: '30000000-0000-4000-8000-000000000001',
            provider: 'zarinpal',
            providerReference: 'PAY-REF',
            verifiedAt: new Date('2026-08-30T10:00:00.000Z'),
          },
        ],
      },
      shipment: {
        id: '40000000-0000-4000-8000-000000000001',
        provider: 'postex',
        providerShipmentId: 'PX-001',
        status: 'DELIVERED',
        shippingCostToman: 90_000,
        creationAttemptedAt: new Date('2026-08-30T11:00:00.000Z'),
      },
      costEntries: [
        {
          id: '50000000-0000-4000-8000-000000000001',
          type: OrderCostEntryType.PAYMENT_GATEWAY_FEE,
          amountToman: 0,
          source: 'zarinpal',
          externalReference: 'PAY-REF',
          occurredAt: new Date('2026-08-30T10:00:00.000Z'),
          reversalOfId: null,
        },
      ],
    };

    const prisma = {
      order: {
        findUnique: jest.fn().mockResolvedValue(order),
      },
    };
    const service = new OrderCostsService(prisma as unknown as PrismaService);

    const result = await service.orderReconciliation(orderId);

    expect(result.reconciled).toBe(false);
    expect(result.missingCosts).toEqual([
      expect.objectContaining({
        code: 'SHIPPING_PROVIDER_COST_MISSING',
        source: 'postex',
        externalReference: 'PX-001',
      }),
      {
        code: 'PLATING_SERVICE_COST_MISSING',
      },
    ]);
    expect(result.missingCosts).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'PAYMENT_GATEWAY_FEE_MISSING',
        }),
      ]),
    );
  });

  it('queries missing gateway costs from verified payment evidence', async () => {
    const prisma = {
      order: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([]),
      },
    };
    const service = new OrderCostsService(prisma as unknown as PrismaService);

    await service.reconciliation({
      limit: 25,
    });

    expect(prisma.order.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({
          payment: {
            is: {
              attempts: {
                some: {
                  status: PaymentAttemptStatus.VERIFIED,
                },
              },
            },
          },
          costEntries: {
            none: {
              type: OrderCostEntryType.PAYMENT_GATEWAY_FEE,
            },
          },
        }),
        take: 25,
      }),
    );
  });
});
