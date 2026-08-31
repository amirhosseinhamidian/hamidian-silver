import { ConflictException } from '@nestjs/common';
import {
  PaymentAttemptStatus,
  PaymentReconciliationResolution,
  PaymentReconciliationStatus,
  PaymentStatus,
} from '../../generated/prisma/enums';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import { PaymentReconciliationService } from './payment-reconciliation.service';

describe('PaymentReconciliationService', () => {
  const reconciliationId = '10000000-0000-4000-8000-000000000001';
  const paymentAttemptId = '20000000-0000-4000-8000-000000000001';
  const paymentId = '30000000-0000-4000-8000-000000000001';
  const actorUserId = '40000000-0000-4000-8000-000000000001';

  function openReconciliation() {
    return {
      id: reconciliationId,
      paymentAttemptId,
      status: PaymentReconciliationStatus.OPEN,
      resolution: null,
      paymentAttempt: {
        id: paymentAttemptId,
        paymentId,
        status: PaymentAttemptStatus.RECONCILIATION_REQUIRED,
        payment: {
          status: PaymentStatus.RECONCILIATION_REQUIRED,
        },
      },
    };
  }

  it('claims and resolves an externally-refunded reconciliation atomically', async () => {
    const transaction = {
      paymentReconciliation: {
        findUnique: jest.fn().mockResolvedValue(openReconciliation()),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: reconciliationId,
          status: PaymentReconciliationStatus.RESOLVED,
          resolution: PaymentReconciliationResolution.REFUNDED_EXTERNALLY,
        }),
      },
      payment: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      paymentAttempt: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    };
    const service = new PaymentReconciliationService(prisma as unknown as PrismaService);

    await service.resolveExternalRefund(
      reconciliationId,
      actorUserId,
      'Refund confirmed in gateway dashboard.',
    );

    expect(transaction.paymentReconciliation.updateMany).toHaveBeenCalledWith({
      where: {
        id: reconciliationId,
        status: PaymentReconciliationStatus.OPEN,
        resolution: null,
        resolvedAt: null,
      },
      data: expect.objectContaining({
        status: PaymentReconciliationStatus.RESOLVED,
        resolution: PaymentReconciliationResolution.REFUNDED_EXTERNALLY,
        resolutionNote: 'Refund confirmed in gateway dashboard.',
        resolvedByUserId: actorUserId,
        resolvedAt: expect.any(Date),
      }),
    });
    expect(transaction.payment.updateMany).toHaveBeenCalledWith({
      where: {
        id: paymentId,
        status: PaymentStatus.RECONCILIATION_REQUIRED,
      },
      data: {
        status: PaymentStatus.REFUNDED,
      },
    });
    expect(transaction.paymentAttempt.updateMany).toHaveBeenCalledWith({
      where: {
        id: paymentAttemptId,
        status: PaymentAttemptStatus.RECONCILIATION_REQUIRED,
      },
      data: {
        status: PaymentAttemptStatus.RECONCILED,
        failureCode: null,
        failureMessage: null,
      },
    });
  });

  it('does not overwrite a reconciliation resolved by another worker', async () => {
    const transaction = {
      paymentReconciliation: {
        findUnique: jest.fn().mockResolvedValueOnce(openReconciliation()).mockResolvedValueOnce({
          id: reconciliationId,
          status: PaymentReconciliationStatus.RESOLVED,
          resolution: PaymentReconciliationResolution.REFUNDED_EXTERNALLY,
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findUniqueOrThrow: jest.fn(),
      },
      payment: {
        updateMany: jest.fn(),
      },
      paymentAttempt: {
        updateMany: jest.fn(),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    };
    const service = new PaymentReconciliationService(prisma as unknown as PrismaService);

    await expect(
      service.resolveExternalRefund(reconciliationId, actorUserId, 'Duplicate manager action'),
    ).resolves.toEqual({
      id: reconciliationId,
      status: PaymentReconciliationStatus.RESOLVED,
      resolution: PaymentReconciliationResolution.REFUNDED_EXTERNALLY,
    });

    expect(transaction.payment.updateMany).not.toHaveBeenCalled();
    expect(transaction.paymentAttempt.updateMany).not.toHaveBeenCalled();
  });

  it('resolves an extra-attempt reconciliation without overwriting a settled payment', async () => {
    const settledReconciliation = {
      ...openReconciliation(),
      paymentAttempt: {
        ...openReconciliation().paymentAttempt,
        payment: {
          status: PaymentStatus.PAID,
        },
      },
    };
    const transaction = {
      paymentReconciliation: {
        findUnique: jest.fn().mockResolvedValue(settledReconciliation),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: reconciliationId,
          status: PaymentReconciliationStatus.RESOLVED,
          resolution: PaymentReconciliationResolution.REFUNDED_EXTERNALLY,
        }),
      },
      payment: {
        updateMany: jest.fn(),
      },
      paymentAttempt: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    };
    const service = new PaymentReconciliationService(prisma as unknown as PrismaService);

    await service.resolveExternalRefund(
      reconciliationId,
      actorUserId,
      'Duplicate charge refunded in gateway dashboard.',
    );

    expect(transaction.payment.updateMany).not.toHaveBeenCalled();
    expect(transaction.paymentAttempt.updateMany).toHaveBeenCalledWith({
      where: {
        id: paymentAttemptId,
        status: PaymentAttemptStatus.RECONCILIATION_REQUIRED,
      },
      data: {
        status: PaymentAttemptStatus.RECONCILED,
        failureCode: null,
        failureMessage: null,
      },
    });
  });

  it('rolls back when payment state changed before reconciliation resolution', async () => {
    const transaction = {
      paymentReconciliation: {
        findUnique: jest.fn().mockResolvedValue(openReconciliation()),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn(),
      },
      payment: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      paymentAttempt: {
        updateMany: jest.fn(),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    };
    const service = new PaymentReconciliationService(prisma as unknown as PrismaService);

    await expect(
      service.resolveExternalRefund(reconciliationId, actorUserId, 'Refund confirmed externally'),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(transaction.paymentAttempt.updateMany).not.toHaveBeenCalled();
  });
});
