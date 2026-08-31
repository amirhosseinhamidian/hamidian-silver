import { ConflictException } from '@nestjs/common';
import { SupplierPayableStatus, SupplierSettlementStatus } from '../../generated/prisma/enums';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import { SupplierSettlementsService } from './supplier-settlements.service';

describe('SupplierSettlementsService terminal lock idempotency', () => {
  const actorUserId = '10000000-0000-4000-8000-000000000001';
  const settlementId = '40000000-0000-4000-8000-000000000001';

  function p2025() {
    return {
      code: 'P2025',
    };
  }

  function draftPaySettlement() {
    return {
      id: settlementId,
      status: SupplierSettlementStatus.DRAFT,
      totalAmountToman: 1_000_000,
      creditAppliedToman: 0,
      payableCount: 1,
      note: null,
      payables: [
        {
          status: SupplierPayableStatus.OPEN,
          amountToman: 1_000_000,
        },
      ],
      items: [{}],
      creditApplications: [],
    };
  }

  it('returns the winning paid settlement when a concurrent pay already committed', async () => {
    const paid = {
      id: settlementId,
      status: SupplierSettlementStatus.PAID,
      paidAmountToman: 1_000_000,
      paymentReference: 'BANK-REF-WINNER',
    };
    const transaction = {
      supplierSettlement: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(draftPaySettlement())
          .mockResolvedValueOnce(paid),
        update: jest.fn().mockRejectedValueOnce(p2025()),
      },
      supplierPayable: {
        updateMany: jest.fn(),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    };
    const service = new SupplierSettlementsService(prisma as unknown as PrismaService);

    await expect(
      service.pay(settlementId, actorUserId, {
        paymentReference: 'BANK-REF-LOSER',
      }),
    ).resolves.toBe(paid);

    expect(transaction.supplierPayable.updateMany).not.toHaveBeenCalled();
    expect(transaction.supplierSettlement.update).toHaveBeenCalledTimes(1);
  });

  it('does not pay payables when cancellation wins the terminal lock', async () => {
    const transaction = {
      supplierSettlement: {
        findUnique: jest.fn().mockResolvedValueOnce(draftPaySettlement()).mockResolvedValueOnce({
          id: settlementId,
          status: SupplierSettlementStatus.CANCELLED,
        }),
        update: jest.fn().mockRejectedValueOnce(p2025()),
      },
      supplierPayable: {
        updateMany: jest.fn(),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    };
    const service = new SupplierSettlementsService(prisma as unknown as PrismaService);

    await expect(
      service.pay(settlementId, actorUserId, {
        paymentReference: 'BANK-REF-LOSER',
      }),
    ).rejects.toThrow('Supplier settlement was cancelled while payment was being recorded.');

    expect(transaction.supplierPayable.updateMany).not.toHaveBeenCalled();
  });

  it('returns the winning cancelled settlement when a concurrent cancel already committed', async () => {
    const cancelled = {
      id: settlementId,
      status: SupplierSettlementStatus.CANCELLED,
    };
    const transaction = {
      supplierSettlement: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({
            id: settlementId,
            status: SupplierSettlementStatus.DRAFT,
            totalAmountToman: 1_000_000,
            creditAppliedToman: 0,
            payableCount: 1,
            note: null,
            creditApplications: [],
          })
          .mockResolvedValueOnce(cancelled),
        update: jest.fn().mockRejectedValueOnce(p2025()),
      },
      supplierPayable: {
        updateMany: jest.fn(),
      },
      supplierCredit: {
        findUnique: jest.fn(),
        updateMany: jest.fn(),
        update: jest.fn(),
      },
      supplierCreditApplication: {
        updateMany: jest.fn(),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    };
    const service = new SupplierSettlementsService(prisma as unknown as PrismaService);

    await expect(
      service.cancel(settlementId, actorUserId, {
        reason: 'Concurrent cancellation.',
      }),
    ).resolves.toBe(cancelled);

    expect(transaction.supplierPayable.updateMany).not.toHaveBeenCalled();
    expect(transaction.supplierCredit.updateMany).not.toHaveBeenCalled();
    expect(transaction.supplierCreditApplication.updateMany).not.toHaveBeenCalled();
  });

  it('does not release settlement assets when payment wins the terminal lock', async () => {
    const transaction = {
      supplierSettlement: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({
            id: settlementId,
            status: SupplierSettlementStatus.DRAFT,
            totalAmountToman: 1_000_000,
            creditAppliedToman: 0,
            payableCount: 1,
            note: null,
            creditApplications: [],
          })
          .mockResolvedValueOnce({
            id: settlementId,
            status: SupplierSettlementStatus.PAID,
          }),
        update: jest.fn().mockRejectedValueOnce(p2025()),
      },
      supplierPayable: {
        updateMany: jest.fn(),
      },
      supplierCredit: {
        findUnique: jest.fn(),
        updateMany: jest.fn(),
        update: jest.fn(),
      },
      supplierCreditApplication: {
        updateMany: jest.fn(),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    };
    const service = new SupplierSettlementsService(prisma as unknown as PrismaService);

    await expect(
      service.cancel(settlementId, actorUserId, {
        reason: 'Stale cancellation.',
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(transaction.supplierPayable.updateMany).not.toHaveBeenCalled();
    expect(transaction.supplierCredit.updateMany).not.toHaveBeenCalled();
    expect(transaction.supplierCreditApplication.updateMany).not.toHaveBeenCalled();
  });
});
