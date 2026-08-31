import type { PrismaService } from '../../infrastructure/database/prisma.service';
import { OrderFinanceService } from './order-finance.service';

describe('OrderFinanceService backfill integrity', () => {
  it('creates valid snapshots while reporting legacy orders with incomplete supplier snapshots', async () => {
    const validOrder = {
      id: '10000000-0000-4000-8000-000000000001',
      orderNumber: 'HS-VALID',
      paidAt: new Date('2026-08-30T10:00:00.000Z'),
      merchandiseTotalToman: 1_000_000,
      platingTotalToman: 0,
      discountTotalToman: 0,
      shippingTotalToman: 50_000,
      taxTotalToman: 0,
      grandTotalToman: 1_050_000,
      items: [
        {
          quantity: 1,
          unitSupplierPriceToman: 600_000,
          supplierIdSnapshot: '30000000-0000-4000-8000-000000000001',
          supplierNameSnapshot: 'Supplier A',
        },
      ],
    };
    const invalidOrder = {
      ...validOrder,
      id: '20000000-0000-4000-8000-000000000001',
      orderNumber: 'HS-LEGACY-BROKEN',
      items: [
        {
          quantity: 1,
          unitSupplierPriceToman: 600_000,
          supplierIdSnapshot: null,
          supplierNameSnapshot: 'Supplier A',
        },
      ],
    };
    const transaction = {
      orderFinanceSnapshot: {
        createMany: jest.fn().mockResolvedValue({
          count: 1,
        }),
      },
    };
    const prisma = {
      order: {
        findMany: jest.fn().mockResolvedValue([validOrder, invalidOrder]),
      },
      $transaction: jest.fn(async (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    };
    const service = new OrderFinanceService(prisma as unknown as PrismaService);

    await expect(service.backfillMissing({ limit: 10 })).resolves.toEqual({
      scanned: 2,
      created: 1,
      skipped: 1,
      issues: [
        {
          orderId: invalidOrder.id,
          orderNumber: invalidOrder.orderNumber,
          reason: 'Supplier snapshot is incomplete for an order finance item.',
        },
      ],
    });

    expect(transaction.orderFinanceSnapshot.createMany).toHaveBeenCalledTimes(1);
  });
});
