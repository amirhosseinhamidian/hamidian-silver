import { BadRequestException, ConflictException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { OrderStatus, PaymentAttemptStatus, PaymentStatus } from '../../generated/prisma/enums';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import type { PaymentGateway } from './payment-gateway.port';
import { PaymentsService } from './payments.service';

describe('PaymentsService verification concurrency', () => {
  const orderId = '10000000-0000-4000-8000-000000000001';
  const paymentId = '20000000-0000-4000-8000-000000000001';
  const attemptId = '30000000-0000-4000-8000-000000000001';

  function setup() {
    const prisma = {
      paymentAttempt: {
        findUnique: jest.fn(),
        updateMany: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    const config = {
      get: jest.fn().mockReturnValue('https://api.example.com/api/v1/payments/callback'),
    };
    const gateway: jest.Mocked<PaymentGateway> = {
      providerCode: 'test',
      initiate: jest.fn(),
      verify: jest.fn(),
    };

    return {
      prisma,
      gateway,
      service: new PaymentsService(
        prisma as unknown as PrismaService,
        config as unknown as ConfigService,
        gateway,
      ),
    };
  }

  function redirectedAttempt() {
    return {
      id: attemptId,
      paymentId,
      amountToman: 1_000_000,
      authority: 'AUTH-1',
      providerReference: null,
      status: PaymentAttemptStatus.REDIRECTED,
      payment: {
        id: paymentId,
        orderId,
        status: PaymentStatus.PENDING,
        order: {
          id: orderId,
          status: OrderStatus.PENDING_PAYMENT,
        },
      },
    };
  }

  it('does not overwrite reconciliation when a stale gateway failure returns late', async () => {
    const { service, prisma, gateway } = setup();

    prisma.paymentAttempt.findUnique
      .mockResolvedValueOnce(redirectedAttempt())
      .mockResolvedValueOnce({
        ...redirectedAttempt(),
        providerReference: 'REF-1',
        status: PaymentAttemptStatus.RECONCILIATION_REQUIRED,
        payment: {
          id: paymentId,
          orderId,
          status: PaymentStatus.RECONCILIATION_REQUIRED,
          order: {
            id: orderId,
            status: OrderStatus.EXPIRED,
          },
        },
      });
    prisma.paymentAttempt.updateMany.mockResolvedValue({ count: 0 });
    gateway.verify.mockResolvedValue({
      success: false,
      code: 'STALE_FAILURE',
      message: 'Late failure response',
    });

    await expect(service.verifyCallback(attemptId, 'AUTH-1')).resolves.toEqual({
      success: true,
      reconciliationRequired: true,
      orderId,
      referenceId: 'REF-1',
    });

    expect(prisma.paymentAttempt.updateMany).toHaveBeenCalledWith({
      where: {
        id: attemptId,
        status: PaymentAttemptStatus.REDIRECTED,
      },
      data: {
        status: PaymentAttemptStatus.FAILED,
        failureCode: 'STALE_FAILURE',
        failureMessage: 'Late failure response',
      },
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('returns idempotent success when successful verification won the race', async () => {
    const { service, prisma, gateway } = setup();

    prisma.paymentAttempt.findUnique
      .mockResolvedValueOnce(redirectedAttempt())
      .mockResolvedValueOnce({
        ...redirectedAttempt(),
        providerReference: 'REF-1',
        status: PaymentAttemptStatus.VERIFIED,
        payment: {
          id: paymentId,
          orderId,
          status: PaymentStatus.PAID,
          order: {
            id: orderId,
            status: OrderStatus.PAID,
          },
        },
      });
    prisma.paymentAttempt.updateMany.mockResolvedValue({ count: 0 });
    gateway.verify.mockResolvedValue({
      success: false,
      code: 'STALE_FAILURE',
    });

    await expect(service.verifyCallback(attemptId, 'AUTH-1')).resolves.toEqual({
      success: true,
      alreadyVerified: true,
      orderId,
      referenceId: 'REF-1',
    });
  });

  it('keeps the normal failure behavior when the CAS succeeds', async () => {
    const { service, prisma, gateway } = setup();

    prisma.paymentAttempt.findUnique.mockResolvedValue(redirectedAttempt());
    prisma.paymentAttempt.updateMany.mockResolvedValue({ count: 1 });
    gateway.verify.mockResolvedValue({
      success: false,
      code: 'DECLINED',
      message: 'Payment was declined',
    });

    await expect(service.verifyCallback(attemptId, 'AUTH-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(prisma.paymentAttempt.findUnique).toHaveBeenCalledTimes(1);
  });

  it('raises a conflict for another concurrent non-terminal state change', async () => {
    const { service, prisma, gateway } = setup();

    prisma.paymentAttempt.findUnique
      .mockResolvedValueOnce(redirectedAttempt())
      .mockResolvedValueOnce({
        ...redirectedAttempt(),
        status: PaymentAttemptStatus.FAILED,
      });
    prisma.paymentAttempt.updateMany.mockResolvedValue({ count: 0 });
    gateway.verify.mockResolvedValue({
      success: false,
      code: 'STALE_FAILURE',
    });

    await expect(service.verifyCallback(attemptId, 'AUTH-1')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});
