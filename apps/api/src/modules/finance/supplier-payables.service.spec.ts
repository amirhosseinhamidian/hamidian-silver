import { SupplierPayableStatus } from '../../generated/prisma/enums';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import { SupplierPayablesService } from './supplier-payables.service';

describe('SupplierPayablesService', () => {
  it('marks an open payable as paid with finance audit metadata', async () => {
    const payableId = '10000000-0000-4000-8000-000000000001';
    const actorUserId = '20000000-0000-4000-8000-000000000001';
    const transaction = {
      supplierPayable: {
        findUnique: jest.fn().mockResolvedValue({
          id: payableId,
          status: SupplierPayableStatus.OPEN,
        }),
        update: jest.fn().mockResolvedValue({
          id: payableId,
          status: SupplierPayableStatus.PAID,
        }),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    };
    const service = new SupplierPayablesService(prisma as unknown as PrismaService);

    await service.markPaid(payableId, actorUserId, {
      paymentReference: 'BANK-REF-1',
      note: 'Supplier transfer confirmed.',
    });

    expect(transaction.supplierPayable.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: payableId,
        },
        data: expect.objectContaining({
          status: SupplierPayableStatus.PAID,
          paidByUserId: actorUserId,
          paymentReference: 'BANK-REF-1',
          settlementNote: 'Supplier transfer confirmed.',
          paidAt: expect.any(Date),
        }),
      }),
    );
  });

  it('returns an already-paid payable idempotently', async () => {
    const payable = {
      id: '10000000-0000-4000-8000-000000000001',
      status: SupplierPayableStatus.PAID,
      paidAt: new Date(),
    };
    const transaction = {
      supplierPayable: {
        findUnique: jest.fn().mockResolvedValue(payable),
        update: jest.fn(),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    };
    const service = new SupplierPayablesService(prisma as unknown as PrismaService);

    await expect(
      service.markPaid(payable.id, '20000000-0000-4000-8000-000000000001', {}),
    ).resolves.toBe(payable);

    expect(transaction.supplierPayable.update).not.toHaveBeenCalled();
  });
});
