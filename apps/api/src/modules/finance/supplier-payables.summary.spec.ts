import { SupplierPayableStatus } from '../../generated/prisma/enums';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import { SupplierPayablesService } from './supplier-payables.service';

describe('SupplierPayablesService summary', () => {
  it('aggregates open and paid totals per supplier', async () => {
    const supplierId = '10000000-0000-4000-8000-000000000001';
    const prisma = {
      supplierPayable: {
        groupBy: jest.fn().mockResolvedValue([
          {
            supplierIdSnapshot: supplierId,
            supplierNameSnapshot: 'Supplier A',
            status: SupplierPayableStatus.OPEN,
            _sum: {
              amountToman: 700_000,
            },
            _count: {
              _all: 2,
            },
            _max: {
              createdAt: new Date('2026-08-30T10:00:00.000Z'),
            },
          },
          {
            supplierIdSnapshot: supplierId,
            supplierNameSnapshot: 'Supplier A',
            status: SupplierPayableStatus.PAID,
            _sum: {
              amountToman: 300_000,
            },
            _count: {
              _all: 1,
            },
            _max: {
              createdAt: new Date('2026-08-29T10:00:00.000Z'),
            },
          },
        ]),
      },
    };
    const service = new SupplierPayablesService(prisma as unknown as PrismaService);

    await expect(service.summary()).resolves.toEqual([
      {
        supplierIdSnapshot: supplierId,
        supplierNameSnapshot: 'Supplier A',
        openAmountToman: 700_000,
        openCount: 2,
        paidAmountToman: 300_000,
        paidCount: 1,
        totalAmountToman: 1_000_000,
        totalCount: 3,
      },
    ]);
  });
});
