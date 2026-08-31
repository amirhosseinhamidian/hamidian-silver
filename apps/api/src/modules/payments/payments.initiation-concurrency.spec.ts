import { ConflictException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { OrderStatus, PaymentAttemptStatus } from '../../generated/prisma/enums';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import { PaymentInitiationUnknownError } from './payment-initiation-unknown.error';
import type { PaymentGateway } from './payment-gateway.port';
import { PaymentsService } from './payments.service';

describe('PaymentsService initiation concurrency', () => {
  const userId = '10000000-0000-4000-8000-000000000001';
  const orderId = '20000000-0000-4000-8000-000000000001';
  const paymentId = '30000000-0000-4000-8000-000000000001';
  const attemptId = '40000000-0000-4000-8000-000000000001';

  function createHarness() {
    const transaction = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: orderId }]),
      order: {
        findFirst: jest.fn().mockResolvedValue({
          id: orderId,
          orderNumber: 'HS-INIT',
          status: OrderStatus.PENDING_PAYMENT,
          grandTotalToman: 1_000_000,
          reservationExpiresAt: new Date(Date.now() + 60_000),
        }),
      },
      payment: {
        upsert: jest.fn().mockResolvedValue({
          id: paymentId,
          orderId,
          amountToman: 1_000_000,
        }),
      },
      paymentAttempt: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: attemptId,
          paymentId,
          provider: 'test',
          amountToman: 1_000_000,
          authority: null,
          paymentUrl: null,
          status: PaymentAttemptStatus.CREATED,
        }),
      },
    };
    const prisma = {
      paymentAttempt: {
        findUnique: jest.fn(),
        updateMany: jest.fn(),
      },
      $transaction: jest.fn(async (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    };
    const config = {
      get: jest.fn().mockReturnValue('https://api.example.com/api/v1/payments/callback'),
    };
    const gateway: jest.Mocked<PaymentGateway> = {
      providerCode: 'test',
      initiate: jest.fn().mockResolvedValue({
        authority: 'AUTH-1',
        paymentUrl: 'https://gateway.example/pay/AUTH-1',
      }),
      verify: jest.fn(),
    };
    const service = new PaymentsService(
      prisma as unknown as PrismaService,
      config as unknown as ConfigService,
      gateway,
    );

    return { service, prisma, gateway };
  }

  it('does not downgrade the attempt when persistence fails after gateway initiation succeeds', async () => {
    const { service, prisma, gateway } = createHarness();
    const persistenceError = new Error('database unavailable');

    prisma.paymentAttempt.updateMany.mockRejectedValue(persistenceError);

    await expect(
      service.initiateOrderPayment(userId, orderId, {
        idempotencyKey: 'init-persist-failure',
      }),
    ).rejects.toBe(persistenceError);

    expect(gateway.initiate).toHaveBeenCalledTimes(1);
    expect(prisma.paymentAttempt.updateMany).toHaveBeenCalledTimes(1);
    expect(prisma.paymentAttempt.updateMany).toHaveBeenCalledWith({
      where: {
        id: attemptId,
        status: PaymentAttemptStatus.CREATED,
      },
      data: {
        authority: 'AUTH-1',
        paymentUrl: 'https://gateway.example/pay/AUTH-1',
        status: PaymentAttemptStatus.REDIRECTED,
        failureMessage: null,
      },
    });
  });

  it('returns the stored redirect when another worker persisted the same provider result', async () => {
    const { service, prisma } = createHarness();

    prisma.paymentAttempt.updateMany.mockResolvedValue({ count: 0 });
    prisma.paymentAttempt.findUnique.mockResolvedValue({
      id: attemptId,
      status: PaymentAttemptStatus.REDIRECTED,
      authority: 'AUTH-1',
      paymentUrl: 'https://gateway.example/pay/AUTH-1',
    });

    await expect(
      service.initiateOrderPayment(userId, orderId, {
        idempotencyKey: 'init-race-same-result',
      }),
    ).resolves.toEqual({
      attemptId,
      status: PaymentAttemptStatus.REDIRECTED,
      authority: 'AUTH-1',
      paymentUrl: 'https://gateway.example/pay/AUTH-1',
    });
  });

  it('rejects a stale provider result when the attempt changed incompatibly', async () => {
    const { service, prisma } = createHarness();

    prisma.paymentAttempt.updateMany.mockResolvedValue({ count: 0 });
    prisma.paymentAttempt.findUnique.mockResolvedValue({
      id: attemptId,
      status: PaymentAttemptStatus.FAILED,
      authority: null,
      paymentUrl: null,
    });

    await expect(
      service.initiateOrderPayment(userId, orderId, {
        idempotencyKey: 'init-race-conflict',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('preserves a created attempt when the gateway initiation outcome is unknown', async () => {
    const { service, prisma, gateway } = createHarness();
    const gatewayError = new PaymentInitiationUnknownError('Test gateway');

    gateway.initiate.mockRejectedValue(gatewayError);

    await expect(
      service.initiateOrderPayment(userId, orderId, {
        idempotencyKey: 'init-gateway-unknown',
      }),
    ).rejects.toBe(gatewayError);

    expect(prisma.paymentAttempt.updateMany).not.toHaveBeenCalled();
  });

  it('still marks a created attempt failed when the gateway call itself fails', async () => {
    const { service, prisma, gateway } = createHarness();
    const gatewayError = new Error('gateway unavailable');

    gateway.initiate.mockRejectedValue(gatewayError);
    prisma.paymentAttempt.updateMany.mockResolvedValue({ count: 1 });

    await expect(
      service.initiateOrderPayment(userId, orderId, {
        idempotencyKey: 'init-gateway-failure',
      }),
    ).rejects.toBe(gatewayError);

    expect(prisma.paymentAttempt.updateMany).toHaveBeenCalledWith({
      where: {
        id: attemptId,
        status: PaymentAttemptStatus.CREATED,
      },
      data: {
        status: PaymentAttemptStatus.FAILED,
        failureMessage: 'Payment initiation failed.',
      },
    });
  });
});
