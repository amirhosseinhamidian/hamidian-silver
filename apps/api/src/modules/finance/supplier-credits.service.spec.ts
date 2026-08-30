import type { PrismaService } from '../../infrastructure/database/prisma.service';
import { SupplierCreditsService } from './supplier-credits.service';

describe('SupplierCreditsService', () => {
  it('filters the supplier credit ledger by immutable supplier snapshot id', async () => {
    const supplierId = '10000000-0000-4000-8000-000000000001';
    const prisma = {
      supplierCredit: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const service = new SupplierCreditsService(prisma as unknown as PrismaService);

    await service.list({
      supplierId,
      limit: 25,
    });

    expect(prisma.supplierCredit.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          supplierIdSnapshot: supplierId,
        }),
        take: 25,
      }),
    );
  });
});
