import { ConflictException } from '@nestjs/common';
import { SupplierPayableStatus } from '../../generated/prisma/enums';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import { SupplierPayablesService } from './supplier-payables.service';

describe('SupplierPayablesService', () => {
  it('claims an open unassigned payable before recording payment metadata', async () => {
    const payableId = '10000000-0000-4000-8000-000000000001';
    const actorUserId = '20000000-0000-4000-8000-000000000001';
    const transaction = {
      supplierPayable: {
        findUnique: jest.fn().mockResolvedValue({
          id: payableId,
          status: SupplierPayableStatus.OPEN,
          settlementId: null,
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
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

    expect(transaction.supplierPayable.updateMany).toHaveBeenCalledWith({
      where: {
        id: payableId,
        status: SupplierPayableStatus.OPEN,
        settlementId: null,
      },
      data: {
        status: SupplierPayableStatus.PAID,
        paidByUserId: actorUserId,
        paymentReference: 'BANK-REF-1',
        settlementNote: 'Supplier transfer confirmed.',
        paidAt: expect.any(Date),
      },
    });
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
        updateMany: jest.fn(),
        findUniqueOrThrow: jest.fn(),
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

    expect(transaction.supplierPayable.updateMany).not.toHaveBeenCalled();
  });

  it('does not overwrite payment metadata when another worker pays the payable first', async () => {
    const payableId = '10000000-0000-4000-8000-000000000001';
    const winner = {
      id: payableId,
      status: SupplierPayableStatus.PAID,
      settlementId: null,
      paidByUserId: '30000000-0000-4000-8000-000000000001',
      paymentReference: 'WINNER-REF',
      settlementNote: 'Recorded by the winning worker.',
      paidAt: new Date(),
    };
    const transaction = {
      supplierPayable: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({
            id: payableId,
            status: SupplierPayableStatus.OPEN,
            settlementId: null,
          })
          .mockResolvedValueOnce(winner),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findUniqueOrThrow: jest.fn(),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    };
    const service = new SupplierPayablesService(prisma as unknown as PrismaService);

    await expect(
      service.markPaid(payableId, '20000000-0000-4000-8000-000000000001', {
        paymentReference: 'LOSER-REF',
        note: 'This metadata must not overwrite the winner.',
      }),
    ).resolves.toBe(winner);

    expect(transaction.supplierPayable.findUniqueOrThrow).not.toHaveBeenCalled();
  });

  it('rejects direct payment when a settlement claims the payable concurrently', async () => {
    const payableId = '10000000-0000-4000-8000-000000000001';
    const transaction = {
      supplierPayable: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({
            id: payableId,
            status: SupplierPayableStatus.OPEN,
            settlementId: null,
          })
          .mockResolvedValueOnce({
            id: payableId,
            status: SupplierPayableStatus.OPEN,
            settlementId: '40000000-0000-4000-8000-000000000001',
          }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findUniqueOrThrow: jest.fn(),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    };
    const service = new SupplierPayablesService(prisma as unknown as PrismaService);

    await expect(
      service.markPaid(payableId, '20000000-0000-4000-8000-000000000001', {}),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(transaction.supplierPayable.findUniqueOrThrow).not.toHaveBeenCalled();
  });
});
