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
  const externalRefundReference = 'GW-REFUND-1';

  function openReconciliation() {
    return {
      id: reconciliationId,
      paymentAttemptId,
      status: PaymentReconciliationStatus.OPEN,
      resolution: null,
      provider: 'zarinpal',
      providerReference: 'PAYMENT-REF-1',
      amountToman: 1_000_000,
      paymentAttempt: {
        id: paymentAttemptId,
        paymentId,
        provider: 'zarinpal',
        providerReference: 'PAYMENT-REF-1',
        amountToman: 1_000_000,
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
      externalRefundReference,
      'Refund confirmed in gateway dashboard.',
    );

    expect(transaction.paymentReconciliation.updateMany).toHaveBeenCalledWith({
      where: {
        id: reconciliationId,
        status: PaymentReconciliationStatus.OPEN,
        resolution: null,
        externalReference: null,
        resolvedAt: null,
      },
      data: expect.objectContaining({
        status: PaymentReconciliationStatus.RESOLVED,
        resolution: PaymentReconciliationResolution.REFUNDED_EXTERNALLY,
        externalReference: externalRefundReference,
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
          externalReference: externalRefundReference,
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
      service.resolveExternalRefund(
        reconciliationId,
        actorUserId,
        externalRefundReference,
        'Duplicate manager action',
      ),
    ).resolves.toEqual({
      id: reconciliationId,
      status: PaymentReconciliationStatus.RESOLVED,
      resolution: PaymentReconciliationResolution.REFUNDED_EXTERNALLY,
      externalReference: externalRefundReference,
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
      externalRefundReference,
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
      service.resolveExternalRefund(
        reconciliationId,
        actorUserId,
        externalRefundReference,
        'Refund confirmed externally',
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(transaction.paymentAttempt.updateMany).not.toHaveBeenCalled();
  });

  it('returns an already resolved reconciliation only for the same external refund reference', async () => {
    const resolved = {
      ...openReconciliation(),
      status: PaymentReconciliationStatus.RESOLVED,
      resolution: PaymentReconciliationResolution.REFUNDED_EXTERNALLY,
      externalReference: externalRefundReference,
      paymentAttempt: {
        ...openReconciliation().paymentAttempt,
        status: PaymentAttemptStatus.RECONCILED,
      },
    };
    const transaction = {
      paymentReconciliation: {
        findUnique: jest.fn().mockResolvedValue(resolved),
        updateMany: jest.fn(),
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
      service.resolveExternalRefund(
        reconciliationId,
        actorUserId,
        externalRefundReference,
        'Idempotent retry.',
      ),
    ).resolves.toBe(resolved);

    await expect(
      service.resolveExternalRefund(
        reconciliationId,
        actorUserId,
        'GW-REFUND-DIFFERENT',
        'Conflicting retry.',
      ),
    ).rejects.toThrow(
      'Payment reconciliation was resolved with a different external refund reference.',
    );
    expect(transaction.paymentReconciliation.updateMany).not.toHaveBeenCalled();
  });

  it('rejects reconciliation resolution when its immutable payment-attempt snapshot drifted', async () => {
    const transaction = {
      paymentReconciliation: {
        findUnique: jest.fn().mockResolvedValue({
          ...openReconciliation(),
          amountToman: 900_000,
        }),
        updateMany: jest.fn(),
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
      service.resolveExternalRefund(
        reconciliationId,
        actorUserId,
        externalRefundReference,
        'Should not resolve.',
      ),
    ).rejects.toThrow('Payment reconciliation snapshot no longer matches the payment attempt.');
    expect(transaction.paymentReconciliation.updateMany).not.toHaveBeenCalled();
    expect(transaction.payment.updateMany).not.toHaveBeenCalled();
    expect(transaction.paymentAttempt.updateMany).not.toHaveBeenCalled();
  });

  it('maps duplicate external refund evidence to a reconciliation conflict', async () => {
    const transaction = {
      paymentReconciliation: {
        findUnique: jest.fn().mockResolvedValue(openReconciliation()),
        updateMany: jest.fn().mockRejectedValue({ code: 'P2002' }),
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
      service.resolveExternalRefund(
        reconciliationId,
        actorUserId,
        externalRefundReference,
        'Duplicate evidence.',
      ),
    ).rejects.toThrow(
      'External refund reference is already used by another payment reconciliation.',
    );
    expect(transaction.payment.updateMany).not.toHaveBeenCalled();
    expect(transaction.paymentAttempt.updateMany).not.toHaveBeenCalled();
  });
});
