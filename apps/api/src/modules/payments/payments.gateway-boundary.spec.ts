import { BadGatewayException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { OrderStatus, PaymentAttemptStatus, PaymentStatus } from '../../generated/prisma/enums';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import type { PaymentGateway } from './payment-gateway.port';
import { PaymentsService } from './payments.service';

describe('PaymentsService gateway boundary validation', () => {
  const userId = '10000000-0000-4000-8000-000000000001';
  const orderId = '20000000-0000-4000-8000-000000000001';
  const paymentId = '30000000-0000-4000-8000-000000000001';
  const attemptId = '40000000-0000-4000-8000-000000000001';

  function createInitiationHarness() {
    const transaction = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: orderId }]),
      order: {
        findFirst: jest.fn().mockResolvedValue({
          id: orderId,
          orderNumber: 'HS-BOUNDARY',
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
      initiate: jest.fn(),
      verify: jest.fn(),
    };
    const service = new PaymentsService(
      prisma as unknown as PrismaService,
      config as unknown as ConfigService,
      gateway,
    );

    return { service, prisma, gateway };
  }

  function createVerificationHarness() {
    const prisma = {
      paymentAttempt: {
        findUnique: jest.fn().mockResolvedValue({
          id: attemptId,
          provider: 'test',
          amountToman: 1_000_000,
          authority: 'AUTH-1',
          status: PaymentAttemptStatus.REDIRECTED,
          providerReference: null,
          payment: {
            id: paymentId,
            orderId,
            status: PaymentStatus.PENDING,
            order: {
              id: orderId,
              status: OrderStatus.PENDING_PAYMENT,
            },
          },
        }),
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
    const service = new PaymentsService(
      prisma as unknown as PrismaService,
      config as unknown as ConfigService,
      gateway,
    );

    return { service, prisma, gateway };
  }

  it('rejects an oversized initiation authority before persistence', async () => {
    const { service, prisma, gateway } = createInitiationHarness();

    gateway.initiate.mockResolvedValue({
      authority: 'A'.repeat(256),
      paymentUrl: 'https://gateway.example/pay/AUTH-1',
    });

    await expect(
      service.initiateOrderPayment(userId, orderId, {
        idempotencyKey: 'boundary-authority',
      }),
    ).rejects.toBeInstanceOf(BadGatewayException);

    expect(prisma.paymentAttempt.updateMany).not.toHaveBeenCalled();
  });

  it('rejects a non-http payment URL before persistence', async () => {
    const { service, prisma, gateway } = createInitiationHarness();

    gateway.initiate.mockResolvedValue({
      authority: 'AUTH-1',
      paymentUrl: 'javascript:alert(1)',
    });

    await expect(
      service.initiateOrderPayment(userId, orderId, {
        idempotencyKey: 'boundary-payment-url',
      }),
    ).rejects.toBeInstanceOf(BadGatewayException);

    expect(prisma.paymentAttempt.updateMany).not.toHaveBeenCalled();
  });

  it('rejects an oversized verification reference before financial finalization', async () => {
    const { service, prisma, gateway } = createVerificationHarness();

    gateway.verify.mockResolvedValue({
      success: true,
      referenceId: 'R'.repeat(256),
    });

    await expect(service.verifyCallback(attemptId, 'AUTH-1')).rejects.toBeInstanceOf(
      BadGatewayException,
    );

    expect(prisma.paymentAttempt.updateMany).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects an out-of-range gateway fee before financial finalization', async () => {
    const { service, prisma, gateway } = createVerificationHarness();

    gateway.verify.mockResolvedValue({
      success: true,
      referenceId: 'REF-1',
      actualFeeToman: 2_147_483_648,
    });

    await expect(service.verifyCallback(attemptId, 'AUTH-1')).rejects.toBeInstanceOf(
      BadGatewayException,
    );

    expect(prisma.paymentAttempt.updateMany).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects oversized failure metadata before persistence', async () => {
    const { service, prisma, gateway } = createVerificationHarness();

    gateway.verify.mockResolvedValue({
      success: false,
      code: 'X'.repeat(121),
      message: 'Gateway rejected the payment.',
    });

    await expect(service.verifyCallback(attemptId, 'AUTH-1')).rejects.toBeInstanceOf(
      BadGatewayException,
    );

    expect(prisma.paymentAttempt.updateMany).not.toHaveBeenCalled();
  });
});
