import { ConflictException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import {
  OrderStatus,
  PaymentAttemptStatus,
  PaymentReconciliationStatus,
  PaymentStatus,
} from '../../generated/prisma/enums';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import type { PaymentGateway } from './payment-gateway.port';
import { PaymentsService } from './payments.service';

describe('PaymentsService callback attempt isolation', () => {
  const attemptId = '10000000-0000-4000-8000-000000000001';
  const paymentId = '20000000-0000-4000-8000-000000000001';
  const orderId = '30000000-0000-4000-8000-000000000001';
  const reconciliationId = '40000000-0000-4000-8000-000000000001';
  const amountToman = 1_000_000;

  const config = {
    get: jest.fn().mockReturnValue('https://api.example.com/api/v1/payments/callback'),
  };

  function redirectedAttempt(paymentStatus: PaymentStatus, orderStatus: OrderStatus) {
    return {
      id: attemptId,
      paymentId,
      provider: 'zarinpal',
      authority: 'AUTH-B',
      paymentUrl: 'https://gateway.example/pay/AUTH-B',
      providerReference: null,
      amountToman,
      verifiedAt: null,
      failureCode: null,
      failureMessage: null,
      status: PaymentAttemptStatus.REDIRECTED,
      reconciliation: null,
      payment: {
        id: paymentId,
        orderId,
        amountToman,
        status: paymentStatus,
        order: {
          id: orderId,
          grandTotalToman: amountToman,
          status: orderStatus,
        },
      },
    };
  }

  function gateway(): jest.Mocked<PaymentGateway> {
    return {
      providerCode: 'zarinpal',
      initiate: jest.fn(),
      verify: jest.fn(),
    };
  }

  it('provider-verifies a second attempt after another attempt paid and reconciles its charge', async () => {
    const attempt = redirectedAttempt(PaymentStatus.PAID, OrderStatus.PAID);
    const transaction = {
      paymentAttempt: {
        findUnique: jest.fn().mockResolvedValue(attempt),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      payment: {
        updateMany: jest.fn(),
      },
      paymentReconciliation: {
        upsert: jest.fn().mockResolvedValue({
          id: reconciliationId,
          status: PaymentReconciliationStatus.OPEN,
        }),
      },
    };
    const prisma = {
      paymentAttempt: {
        findUnique: jest.fn().mockResolvedValue(attempt),
        updateMany: jest.fn(),
      },
      $transaction: jest.fn(async (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    };
    const paymentGateway = gateway();
    paymentGateway.verify.mockResolvedValue({
      success: true,
      referenceId: 'REF-B',
    });
    const service = new PaymentsService(
      prisma as unknown as PrismaService,
      config as unknown as ConfigService,
      paymentGateway,
    );

    await expect(service.verifyCallback(attemptId, 'AUTH-B')).resolves.toEqual({
      success: true,
      reconciliationRequired: true,
      reconciliationId,
      orderId,
      referenceId: 'REF-B',
    });

    expect(paymentGateway.verify).toHaveBeenCalledWith({
      authority: 'AUTH-B',
      amountRial: '10000000',
    });
    expect(transaction.paymentAttempt.updateMany).toHaveBeenCalledWith({
      where: {
        id: attemptId,
        status: PaymentAttemptStatus.REDIRECTED,
      },
      data: expect.objectContaining({
        status: PaymentAttemptStatus.RECONCILIATION_REQUIRED,
        providerReference: 'REF-B',
        verifiedAt: expect.any(Date),
      }),
    });
    expect(transaction.payment.updateMany).not.toHaveBeenCalled();
    expect(transaction.paymentReconciliation.upsert).toHaveBeenCalledWith({
      where: {
        paymentAttemptId: attemptId,
      },
      update: {
        providerReference: 'REF-B',
        reason: 'Gateway verified payment after order reached PAID.',
      },
      create: {
        paymentAttemptId: attemptId,
        provider: 'zarinpal',
        providerReference: 'REF-B',
        amountToman,
        detectedOrderStatus: OrderStatus.PAID,
        reason: 'Gateway verified payment after order reached PAID.',
      },
    });
  });

  it('does not inherit aggregate success when a failed verification loses its attempt CAS', async () => {
    const initial = redirectedAttempt(PaymentStatus.PENDING, OrderStatus.PENDING_PAYMENT);
    const current = {
      ...redirectedAttempt(PaymentStatus.PAID, OrderStatus.PAID),
      status: PaymentAttemptStatus.FAILED,
      failureCode: 'DECLINED',
      failureMessage: 'Payment verification failed.',
    };
    const prisma = {
      paymentAttempt: {
        findUnique: jest.fn().mockResolvedValueOnce(initial).mockResolvedValueOnce(current),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      $transaction: jest.fn(),
    };
    const paymentGateway = gateway();
    paymentGateway.verify.mockResolvedValue({
      success: false,
      code: 'DECLINED',
      message: 'Payment verification failed.',
    });
    const service = new PaymentsService(
      prisma as unknown as PrismaService,
      config as unknown as ConfigService,
      paymentGateway,
    );

    await expect(service.verifyCallback(attemptId, 'AUTH-B')).rejects.toBeInstanceOf(
      ConflictException,
    );

    expect(paymentGateway.verify).toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('reconciles a provider-verified amount snapshot mismatch before economic finalization', async () => {
    const callbackAttempt = redirectedAttempt(PaymentStatus.PENDING, OrderStatus.PENDING_PAYMENT);
    const mismatchedAttempt = {
      ...callbackAttempt,
      payment: {
        ...callbackAttempt.payment,
        amountToman: 900_000,
      },
    };
    const transaction = {
      paymentAttempt: {
        findUnique: jest.fn().mockResolvedValue(mismatchedAttempt),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      order: {
        updateMany: jest.fn(),
      },
      payment: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      paymentReconciliation: {
        upsert: jest.fn().mockResolvedValue({
          id: reconciliationId,
          status: PaymentReconciliationStatus.OPEN,
        }),
      },
    };
    const prisma = {
      paymentAttempt: {
        findUnique: jest.fn().mockResolvedValue(callbackAttempt),
        updateMany: jest.fn(),
      },
      $transaction: jest.fn(async (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    };
    const paymentGateway = gateway();
    paymentGateway.verify.mockResolvedValue({
      success: true,
      referenceId: 'REF-MISMATCH',
    });
    const service = new PaymentsService(
      prisma as unknown as PrismaService,
      config as unknown as ConfigService,
      paymentGateway,
    );

    await expect(service.verifyCallback(attemptId, 'AUTH-B')).resolves.toEqual({
      success: true,
      reconciliationRequired: true,
      reconciliationId,
      orderId,
      referenceId: 'REF-MISMATCH',
    });

    expect(transaction.order.updateMany).not.toHaveBeenCalled();
    expect(transaction.payment.updateMany).toHaveBeenCalledWith({
      where: {
        id: paymentId,
        status: PaymentStatus.PENDING,
      },
      data: {
        status: PaymentStatus.RECONCILIATION_REQUIRED,
      },
    });
    expect(transaction.paymentReconciliation.upsert).toHaveBeenCalledWith({
      where: {
        paymentAttemptId: attemptId,
      },
      update: {
        providerReference: 'REF-MISMATCH',
        reason: 'Verified payment amount snapshots do not match the Payment and Order totals.',
      },
      create: expect.objectContaining({
        paymentAttemptId: attemptId,
        providerReference: 'REF-MISMATCH',
        amountToman,
        detectedOrderStatus: OrderStatus.PENDING_PAYMENT,
      }),
    });
  });
});
