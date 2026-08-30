import { SupplierPayableStatus, SupplierSettlementStatus } from '../../generated/prisma/enums';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import { SupplierSettlementsService } from './supplier-settlements.service';

describe('SupplierSettlementsService', () => {
  const actorUserId = '10000000-0000-4000-8000-000000000001';
  const supplierId = '20000000-0000-4000-8000-000000000001';
  const payableIds = [
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000002',
  ];

  it('creates a draft settlement and atomically claims open payables', async () => {
    const payables = payableIds.map((id, index) => ({
      id,
      supplierIdSnapshot: supplierId,
      supplierNameSnapshot: 'Supplier A',
      status: SupplierPayableStatus.OPEN,
      settlementId: null,
      amountToman: index === 0 ? 400_000 : 600_000,
      createdAt: new Date(),
    }));
    const transaction = {
      supplierPayable: {
        findMany: jest.fn().mockResolvedValue(payables),
        updateMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
      supplierSettlement: {
        create: jest.fn().mockResolvedValue({
          id: '40000000-0000-4000-8000-000000000001',
          totalAmountToman: 1_000_000,
        }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({}),
      },
      supplierSettlementItem: {
        createMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    };
    const service = new SupplierSettlementsService(prisma as unknown as PrismaService);

    await service.create(actorUserId, {
      payableIds,
      note: 'August settlement',
    });

    expect(transaction.supplierSettlement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        supplierIdSnapshot: supplierId,
        supplierNameSnapshot: 'Supplier A',
        totalAmountToman: 1_000_000,
        payableCount: 2,
        createdByUserId: actorUserId,
      }),
    });
    expect(transaction.supplierPayable.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: SupplierPayableStatus.OPEN,
          settlementId: null,
        }),
      }),
    );
  });

  it('rejects a batch containing payables from different suppliers', async () => {
    const transaction = {
      supplierPayable: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: payableIds[0],
            supplierIdSnapshot: supplierId,
            supplierNameSnapshot: 'Supplier A',
            status: SupplierPayableStatus.OPEN,
            settlementId: null,
            amountToman: 400_000,
          },
          {
            id: payableIds[1],
            supplierIdSnapshot: '20000000-0000-4000-8000-000000000002',
            supplierNameSnapshot: 'Supplier B',
            status: SupplierPayableStatus.OPEN,
            settlementId: null,
            amountToman: 600_000,
          },
        ]),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    };
    const service = new SupplierSettlementsService(prisma as unknown as PrismaService);

    await expect(
      service.create(actorUserId, {
        payableIds,
      }),
    ).rejects.toThrow('All supplier payables in a settlement must belong to the same supplier.');
  });

  it('pays every payable and the settlement in one transaction', async () => {
    const settlementId = '40000000-0000-4000-8000-000000000001';
    const transaction = {
      supplierSettlement: {
        findUnique: jest.fn().mockResolvedValue({
          id: settlementId,
          status: SupplierSettlementStatus.DRAFT,
          totalAmountToman: 1_000_000,
          payableCount: 2,
          note: null,
          payables: [
            {
              status: SupplierPayableStatus.OPEN,
              amountToman: 400_000,
            },
            {
              status: SupplierPayableStatus.OPEN,
              amountToman: 600_000,
            },
          ],
          items: [{}, {}],
        }),
        update: jest.fn().mockResolvedValue({
          id: settlementId,
          status: SupplierSettlementStatus.PAID,
        }),
      },
      supplierPayable: {
        updateMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    };
    const service = new SupplierSettlementsService(prisma as unknown as PrismaService);

    await service.pay(settlementId, actorUserId, {
      paymentReference: 'BANK-REF-1',
    });

    expect(transaction.supplierPayable.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: SupplierPayableStatus.PAID,
          paidByUserId: actorUserId,
          paymentReference: 'BANK-REF-1',
          paidAt: expect.any(Date),
        }),
      }),
    );
    expect(transaction.supplierSettlement.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: SupplierSettlementStatus.PAID,
          paidByUserId: actorUserId,
          paymentReference: 'BANK-REF-1',
          paidAt: expect.any(Date),
        }),
      }),
    );
  });

  it('cancels a draft settlement and releases payables for a future batch', async () => {
    const settlementId = '40000000-0000-4000-8000-000000000001';
    const transaction = {
      supplierSettlement: {
        findUnique: jest.fn().mockResolvedValue({
          id: settlementId,
          status: SupplierSettlementStatus.DRAFT,
          payableCount: 2,
          note: null,
        }),
        update: jest.fn().mockResolvedValue({
          id: settlementId,
          status: SupplierSettlementStatus.CANCELLED,
        }),
      },
      supplierPayable: {
        updateMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    };
    const service = new SupplierSettlementsService(prisma as unknown as PrismaService);

    await service.cancel(settlementId, actorUserId, {
      reason: 'Transfer plan changed.',
    });

    expect(transaction.supplierPayable.updateMany).toHaveBeenCalledWith({
      where: {
        settlementId,
        status: SupplierPayableStatus.OPEN,
      },
      data: {
        settlementId: null,
      },
    });
  });
});
