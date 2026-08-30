import {
  SupplierCreditApplicationStatus,
  SupplierCreditStatus,
  SupplierPayableStatus,
  SupplierSettlementStatus,
} from '../../generated/prisma/enums';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import { SupplierSettlementsService } from './supplier-settlements.service';

describe('SupplierSettlementsService credit netting', () => {
  const actorUserId = '10000000-0000-4000-8000-000000000001';
  const supplierId = '20000000-0000-4000-8000-000000000001';
  const settlementId = '30000000-0000-4000-8000-000000000001';
  const creditId = '40000000-0000-4000-8000-000000000001';
  const applicationId = '50000000-0000-4000-8000-000000000001';

  it('partially applies supplier credit with atomic settlement and credit guards', async () => {
    const transaction = {
      supplierCreditApplication: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: applicationId,
          status: SupplierCreditApplicationStatus.ACTIVE,
        }),
      },
      supplierSettlement: {
        findUnique: jest.fn().mockResolvedValue({
          id: settlementId,
          status: SupplierSettlementStatus.DRAFT,
          supplierIdSnapshot: supplierId,
          totalAmountToman: 1_000_000,
          creditAppliedToman: 100_000,
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      supplierCredit: {
        findUnique: jest.fn().mockResolvedValue({
          id: creditId,
          supplierIdSnapshot: supplierId,
          amountToman: 800_000,
          appliedAmountToman: 200_000,
          status: SupplierCreditStatus.PARTIALLY_APPLIED,
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    };
    const service = new SupplierSettlementsService(prisma as unknown as PrismaService);

    await service.applyCredit(settlementId, actorUserId, {
      supplierCreditId: creditId,
      amountToman: 300_000,
      idempotencyKey: 'credit-apply-001',
    });

    expect(transaction.supplierSettlement.updateMany).toHaveBeenCalledWith({
      where: {
        id: settlementId,
        status: SupplierSettlementStatus.DRAFT,
        creditAppliedToman: 100_000,
      },
      data: {
        creditAppliedToman: {
          increment: 300_000,
        },
      },
    });

    expect(transaction.supplierCredit.updateMany).toHaveBeenCalledWith({
      where: {
        id: creditId,
        status: {
          in: [SupplierCreditStatus.AVAILABLE, SupplierCreditStatus.PARTIALLY_APPLIED],
        },
        appliedAmountToman: 200_000,
      },
      data: {
        appliedAmountToman: {
          increment: 300_000,
        },
      },
    });
  });

  it('removes an active application and restores credit capacity', async () => {
    const transaction = {
      supplierCreditApplication: {
        findUnique: jest.fn().mockResolvedValue({
          id: applicationId,
          settlementId,
          amountToman: 250_000,
          status: SupplierCreditApplicationStatus.ACTIVE,
          settlement: {
            id: settlementId,
            status: SupplierSettlementStatus.DRAFT,
            creditAppliedToman: 500_000,
          },
          supplierCredit: {
            id: creditId,
            amountToman: 1_000_000,
            appliedAmountToman: 600_000,
          },
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: applicationId,
          status: SupplierCreditApplicationStatus.REMOVED,
        }),
      },
      supplierSettlement: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      supplierCredit: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    };
    const service = new SupplierSettlementsService(prisma as unknown as PrismaService);

    await service.removeCredit(settlementId, applicationId, actorUserId, {
      reason: 'Use credit in another batch.',
    });

    expect(transaction.supplierCredit.updateMany).toHaveBeenCalledWith({
      where: {
        id: creditId,
        appliedAmountToman: 600_000,
        status: {
          not: SupplierCreditStatus.VOIDED,
        },
      },
      data: {
        appliedAmountToman: {
          decrement: 250_000,
        },
      },
    });
  });

  it('snapshots the actual cash paid after applied supplier credits', async () => {
    const transaction = {
      supplierSettlement: {
        findUnique: jest.fn().mockResolvedValue({
          id: settlementId,
          status: SupplierSettlementStatus.DRAFT,
          totalAmountToman: 1_000_000,
          creditAppliedToman: 350_000,
          payableCount: 2,
          note: null,
          payables: [
            { status: SupplierPayableStatus.OPEN, amountToman: 400_000 },
            { status: SupplierPayableStatus.OPEN, amountToman: 600_000 },
          ],
          items: [{}, {}],
          creditApplications: [{ amountToman: 350_000 }],
        }),
        update: jest.fn().mockResolvedValueOnce({}).mockResolvedValueOnce({
          id: settlementId,
          status: SupplierSettlementStatus.PAID,
          paidAmountToman: 650_000,
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
      paymentReference: 'BANK-NET-001',
    });

    expect(transaction.supplierSettlement.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: SupplierSettlementStatus.PAID,
          paidAmountToman: 650_000,
          paymentReference: 'BANK-NET-001',
        }),
      }),
    );
  });

  it('releases active credits when a draft settlement is cancelled', async () => {
    const transaction = {
      supplierSettlement: {
        findUnique: jest.fn().mockResolvedValue({
          id: settlementId,
          status: SupplierSettlementStatus.DRAFT,
          creditAppliedToman: 300_000,
          payableCount: 2,
          note: null,
          creditApplications: [
            {
              id: applicationId,
              amountToman: 300_000,
              supplierCredit: {
                id: creditId,
                amountToman: 800_000,
                appliedAmountToman: 500_000,
              },
            },
          ],
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      supplierPayable: {
        updateMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
      supplierCredit: {
        findUnique: jest.fn().mockResolvedValue({
          id: creditId,
          amountToman: 800_000,
          appliedAmountToman: 500_000,
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn().mockResolvedValue({}),
      },
      supplierCreditApplication: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    };
    const service = new SupplierSettlementsService(prisma as unknown as PrismaService);

    await service.cancel(settlementId, actorUserId, {
      reason: 'Settlement plan changed.',
    });

    expect(transaction.supplierCreditApplication.updateMany).toHaveBeenCalledWith({
      where: {
        id: applicationId,
        status: SupplierCreditApplicationStatus.ACTIVE,
      },
      data: expect.objectContaining({
        status: SupplierCreditApplicationStatus.REMOVED,
        removedByUserId: actorUserId,
        removedAt: expect.any(Date),
      }),
    });
  });
});
