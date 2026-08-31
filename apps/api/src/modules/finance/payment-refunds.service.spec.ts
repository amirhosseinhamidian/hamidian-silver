import {
  PaymentAttemptStatus,
  PaymentRefundStatus,
  PaymentStatus,
} from '../../generated/prisma/enums';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import { PaymentRefundsService } from './payment-refunds.service';

describe('PaymentRefundsService', () => {
  const actorUserId = '10000000-0000-4000-8000-000000000001';
  const orderId = '20000000-0000-4000-8000-000000000001';
  const paymentId = '30000000-0000-4000-8000-000000000001';
  const refundId = '40000000-0000-4000-8000-000000000001';

  it('allocates refund capacity atomically when creating a pending refund', async () => {
    const transaction = {
      payment: {
        findUnique: jest.fn().mockResolvedValue({
          id: paymentId,
          orderId,
          status: PaymentStatus.PAID,
          amountToman: 1_000_000,
          refundedAmountToman: 0,
          refundAllocatedToman: 200_000,
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
              providerReference: 'PAY-REF-1',
              status: PaymentAttemptStatus.VERIFIED,
            },
          ],
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      paymentRefund: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: refundId,
          status: PaymentRefundStatus.PENDING,
        }),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    };
    const service = new PaymentRefundsService(prisma as unknown as PrismaService);

    await service.create(actorUserId, {
      orderId,
      amountToman: 300_000,
      idempotencyKey: 'refund-key-001',
    });

    expect(transaction.payment.updateMany).toHaveBeenCalledWith({
      where: {
        id: paymentId,
        status: {
          in: [PaymentStatus.PAID, PaymentStatus.PARTIALLY_REFUNDED],
        },
        refundAllocatedToman: {
          lte: 700_000,
        },
      },
      data: {
        refundAllocatedToman: {
          increment: 300_000,
        },
      },
    });
    expect(transaction.paymentRefund.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          paymentId,
          amountToman: 300_000,
          providerSnapshot: 'zarinpal',
          originalProviderReferenceSnapshot: 'PAY-REF-1',
          requestedByUserId: actorUserId,
        }),
      }),
    );
  });

  it('rejects a refund that exceeds remaining allocated capacity', async () => {
    const transaction = {
      payment: {
        findUnique: jest.fn().mockResolvedValue({
          id: paymentId,
          status: PaymentStatus.PARTIALLY_REFUNDED,
          amountToman: 1_000_000,
          refundedAmountToman: 400_000,
          refundAllocatedToman: 800_000,
          order: {
            financeSnapshot: {
              id: '50000000-0000-4000-8000-000000000001',
            },
          },
          attempts: [],
        }),
      },
      paymentRefund: {
        findUnique: jest.fn().mockResolvedValue(null),
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
        idempotencyKey: 'refund-key-002',
      }),
    ).rejects.toThrow('Refund amount exceeds the remaining refundable payment amount.');
  });

  it('confirms a partial refund and marks the payment partially refunded', async () => {
    const transaction = {
      paymentRefund: {
        findUnique: jest.fn().mockResolvedValue({
          id: refundId,
          paymentId,
          status: PaymentRefundStatus.PENDING,
          amountToman: 300_000,
          payment: {
            id: paymentId,
            status: PaymentStatus.PAID,
            amountToman: 1_000_000,
            refundedAmountToman: 0,
            refundAllocatedToman: 300_000,
          },
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: refundId,
          status: PaymentRefundStatus.CONFIRMED,
        }),
      },
      payment: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    };
    const service = new PaymentRefundsService(prisma as unknown as PrismaService);

    await service.confirm(refundId, actorUserId, {
      externalReference: 'BANK-REFUND-1',
    });

    expect(transaction.payment.updateMany).toHaveBeenCalledWith({
      where: {
        id: paymentId,
        status: PaymentStatus.PAID,
        amountToman: 1_000_000,
        refundedAmountToman: 0,
        refundAllocatedToman: 300_000,
      },
      data: {
        refundedAmountToman: {
          increment: 300_000,
        },
        status: PaymentStatus.PARTIALLY_REFUNDED,
      },
    });
  });

  it('marks the payment fully refunded when confirmed refunds reach the original amount', async () => {
    const transaction = {
      paymentRefund: {
        findUnique: jest.fn().mockResolvedValue({
          id: refundId,
          paymentId,
          status: PaymentRefundStatus.PENDING,
          amountToman: 400_000,
          payment: {
            id: paymentId,
            status: PaymentStatus.PARTIALLY_REFUNDED,
            amountToman: 1_000_000,
            refundedAmountToman: 600_000,
            refundAllocatedToman: 1_000_000,
          },
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: refundId,
          status: PaymentRefundStatus.CONFIRMED,
        }),
      },
      payment: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    };
    const service = new PaymentRefundsService(prisma as unknown as PrismaService);

    await service.confirm(refundId, actorUserId, {
      externalReference: 'BANK-REFUND-2',
    });

    expect(transaction.payment.updateMany).toHaveBeenCalledWith({
      where: {
        id: paymentId,
        status: PaymentStatus.PARTIALLY_REFUNDED,
        amountToman: 1_000_000,
        refundedAmountToman: 600_000,
        refundAllocatedToman: 1_000_000,
      },
      data: {
        refundedAmountToman: {
          increment: 400_000,
        },
        status: PaymentStatus.REFUNDED,
      },
    });
  });

  it('rolls back confirmation when the payment aggregate changed concurrently', async () => {
    const transaction = {
      paymentRefund: {
        findUnique: jest.fn().mockResolvedValue({
          id: refundId,
          paymentId,
          status: PaymentRefundStatus.PENDING,
          amountToman: 300_000,
          payment: {
            id: paymentId,
            status: PaymentStatus.PAID,
            amountToman: 1_000_000,
            refundedAmountToman: 0,
            refundAllocatedToman: 300_000,
          },
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn(),
      },
      payment: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
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
        externalReference: 'BANK-REFUND-RACE',
      }),
    ).rejects.toThrow('Payment refund totals changed; reload and retry.');

    expect(transaction.paymentRefund.findUniqueOrThrow).not.toHaveBeenCalled();
  });

  it('cancels a pending refund and releases its allocated capacity', async () => {
    const transaction = {
      paymentRefund: {
        findUnique: jest.fn().mockResolvedValue({
          id: refundId,
          paymentId,
          status: PaymentRefundStatus.PENDING,
          amountToman: 250_000,
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: refundId,
          status: PaymentRefundStatus.CANCELLED,
        }),
      },
      payment: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    };
    const service = new PaymentRefundsService(prisma as unknown as PrismaService);

    await service.cancel(refundId, actorUserId, {
      reason: 'External refund was not executed.',
    });

    expect(transaction.payment.updateMany).toHaveBeenCalledWith({
      where: {
        id: paymentId,
        refundAllocatedToman: {
          gte: 250_000,
        },
      },
      data: {
        refundAllocatedToman: {
          decrement: 250_000,
        },
      },
    });
  });
});
