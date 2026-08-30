import { OrderCostEntryType } from '../../generated/prisma/enums';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import { OrderCostsService } from './order-costs.service';

describe('OrderCostsService actual provider cost ingestion', () => {
  it('records zero actual provider cost as reconciliation evidence', async () => {
    const transaction = {
      orderCostEntry: {
        findUnique: jest.fn().mockResolvedValue(null),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: '10000000-0000-4000-8000-000000000001',
          orderId: '20000000-0000-4000-8000-000000000001',
          type: OrderCostEntryType.PAYMENT_GATEWAY_FEE,
          amountToman: 0,
          source: 'gateway',
          externalReference: 'REF-001',
        }),
      },
    };
    const service = new OrderCostsService({} as PrismaService);

    await service.recordActualCost(transaction as never, {
      orderId: '20000000-0000-4000-8000-000000000001',
      type: OrderCostEntryType.PAYMENT_GATEWAY_FEE,
      amountToman: 0,
      source: 'gateway',
      externalReference: 'REF-001',
      idempotencyKey: 'payment-attempt:attempt-1:gateway-fee',
      occurredAt: new Date('2026-08-30T12:00:00.000Z'),
    });

    expect(transaction.orderCostEntry.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          type: OrderCostEntryType.PAYMENT_GATEWAY_FEE,
          amountToman: 0,
          source: 'gateway',
          externalReference: 'REF-001',
          createdByUserId: null,
        }),
      ],
      skipDuplicates: true,
    });
  });

  it('returns the existing provider cost on an identical retry', async () => {
    const existing = {
      id: '10000000-0000-4000-8000-000000000001',
      orderId: '20000000-0000-4000-8000-000000000001',
      type: OrderCostEntryType.SHIPPING_PROVIDER,
      amountToman: 75_000,
      source: 'shipping-provider',
      externalReference: 'SHIP-001',
    };
    const transaction = {
      orderCostEntry: {
        findUnique: jest.fn().mockResolvedValue(existing),
        createMany: jest.fn(),
        findUniqueOrThrow: jest.fn(),
      },
    };
    const service = new OrderCostsService({} as PrismaService);

    await expect(
      service.recordActualCost(transaction as never, {
        orderId: existing.orderId,
        type: existing.type,
        amountToman: existing.amountToman,
        source: existing.source,
        externalReference: existing.externalReference,
        idempotencyKey: 'shipment:shipment-1:provider-cost',
        occurredAt: new Date(),
      }),
    ).resolves.toBe(existing);

    expect(transaction.orderCostEntry.createMany).not.toHaveBeenCalled();
  });
});
