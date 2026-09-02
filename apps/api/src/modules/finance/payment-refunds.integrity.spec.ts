import {
  PaymentAttemptStatus,
  PaymentRefundStatus,
  PaymentStatus,
} from '../../generated/prisma/enums';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import { PaymentRefundsService } from './payment-refunds.service';

describe('PaymentRefundsService integrity hardening', () => {
  const actorUserId = '10000000-0000-4000-8000-000000000001';
  const orderId = '20000000-0000-4000-8000-000000000001';
  const paymentId = '30000000-0000-4000-8000-000000000001';
  const refundId = '40000000-0000-4000-8000-000000000001';

  function pendingRefund() {
    return {
      id: refundId,
      paymentId,
      status: PaymentRefundStatus.PENDING,
      amountToman: 300_000,
      externalReference: null,
      payment: {
        id: paymentId,
        status: PaymentStatus.PAID,
        amountToman: 1_000_000,
        refundedAmountToman: 0,
        refundAllocatedToman: 300_000,
      },
    };
  }

  it('requires verified provider identity before allocating refund capacity', async () => {
    const transaction = {
      payment: {
        findUnique: jest.fn().mockResolvedValue({
          id: paymentId,
          orderId,
          status: PaymentStatus.PAID,
          amountToman: 1_000_000,
          refundedAmountToman: 0,
          refundAllocatedToman: 0,
          order: {
            id: orderId,
            orderNumber: 'HS-TEST',
            financeSnapshot: {
              id: '50000000-0000-4000-8000-000000000001',
            },
          },
          attempts: [
            {
              provider: 'zarinpal',
              providerReference: null,
              status: PaymentAttemptStatus.VERIFIED,
            },
          ],
        }),
        updateMany: jest.fn(),
      },
      paymentRefund: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    };
    const service = new PaymentRefundsService(prisma as unknown as PrismaService);

    await expect(
      service.create(actorUserId, {
        orderId,
        amountToman: 300_000,
        idempotencyKey: 'refund-integrity-001',
      }),
    ).rejects.toThrow(
      'Verified payment provider identity is required before recording a customer refund.',
    );

    expect(transaction.payment.updateMany).not.toHaveBeenCalled();
    expect(transaction.paymentRefund.create).not.toHaveBeenCalled();
  });

  it('returns an already confirmed refund only when the external reference matches', async () => {
    const confirmed = {
      ...pendingRefund(),
      status: PaymentRefundStatus.CONFIRMED,
      externalReference: 'BANK-REFUND-1',
    };
    const transaction = {
      paymentRefund: {
        findUnique: jest.fn().mockResolvedValue(confirmed),
        updateMany: jest.fn(),
        findUniqueOrThrow: jest.fn().mockResolvedValue(confirmed),
      },
      payment: {
        updateMany: jest.fn(),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    };
    const service = new PaymentRefundsService(prisma as unknown as PrismaService);

    await expect(
      service.confirm(refundId, actorUserId, {
        externalReference: 'BANK-REFUND-1',
      }),
    ).resolves.toBe(confirmed);

    expect(transaction.paymentRefund.updateMany).not.toHaveBeenCalled();
    expect(transaction.payment.updateMany).not.toHaveBeenCalled();
  });

  it('rejects an already confirmed refund when a retry supplies another external reference', async () => {
    const confirmed = {
      ...pendingRefund(),
      status: PaymentRefundStatus.CONFIRMED,
      externalReference: 'BANK-REFUND-1',
    };
    const transaction = {
      paymentRefund: {
        findUnique: jest.fn().mockResolvedValue(confirmed),
        updateMany: jest.fn(),
        findUniqueOrThrow: jest.fn(),
      },
      payment: {
        updateMany: jest.fn(),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    };
    const service = new PaymentRefundsService(prisma as unknown as PrismaService);

    await expect(
      service.confirm(refundId, actorUserId, {
        externalReference: 'BANK-REFUND-2',
      }),
    ).rejects.toThrow('Payment refund is already confirmed with a different external reference.');

    expect(transaction.paymentRefund.findUniqueOrThrow).not.toHaveBeenCalled();
    expect(transaction.payment.updateMany).not.toHaveBeenCalled();
  });

  it('rejects a concurrent confirmation winner that used another external reference', async () => {
    const pending = pendingRefund();
    const concurrentWinner = {
      id: refundId,
      paymentId,
      status: PaymentRefundStatus.CONFIRMED,
      amountToman: pending.amountToman,
      externalReference: 'BANK-REFUND-OTHER',
    };
    const transaction = {
      paymentRefund: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(pending)
          .mockResolvedValueOnce(concurrentWinner),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findUniqueOrThrow: jest.fn(),
      },
      payment: {
        updateMany: jest.fn(),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    };
    const service = new PaymentRefundsService(prisma as unknown as PrismaService);

    await expect(
      service.confirm(refundId, actorUserId, {
        externalReference: 'BANK-REFUND-THIS-REQUEST',
      }),
    ).rejects.toThrow('Payment refund is already confirmed with a different external reference.');

    expect(transaction.payment.updateMany).not.toHaveBeenCalled();
  });

  it('returns a concurrent confirmation winner idempotently when the reference matches', async () => {
    const pending = pendingRefund();
    const concurrentWinner = {
      id: refundId,
      paymentId,
      status: PaymentRefundStatus.CONFIRMED,
      amountToman: pending.amountToman,
      externalReference: 'BANK-REFUND-SAME',
    };
    const transaction = {
      paymentRefund: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(pending)
          .mockResolvedValueOnce(concurrentWinner),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue(concurrentWinner),
      },
      payment: {
        updateMany: jest.fn(),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    };
    const service = new PaymentRefundsService(prisma as unknown as PrismaService);

    await expect(
      service.confirm(refundId, actorUserId, {
        externalReference: 'BANK-REFUND-SAME',
      }),
    ).resolves.toBe(concurrentWinner);

    expect(transaction.payment.updateMany).not.toHaveBeenCalled();
  });

  it('maps duplicate confirmed provider references to a deterministic conflict', async () => {
    const transaction = {
      paymentRefund: {
        findUnique: jest.fn().mockResolvedValue(pendingRefund()),
        updateMany: jest.fn().mockRejectedValue({
          code: 'P2002',
        }),
        findUniqueOrThrow: jest.fn(),
      },
      payment: {
        updateMany: jest.fn(),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    };
    const service = new PaymentRefundsService(prisma as unknown as PrismaService);

    await expect(
      service.confirm(refundId, actorUserId, {
        externalReference: 'BANK-REFUND-DUPLICATE',
      }),
    ).rejects.toThrow('External refund reference is already assigned to another confirmed refund.');

    expect(transaction.payment.updateMany).not.toHaveBeenCalled();
  });
});
