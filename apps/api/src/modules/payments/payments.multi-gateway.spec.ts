import type { ConfigService } from '@nestjs/config';
import { PaymentAttemptStatus } from '../../generated/prisma/enums';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import { PAYMENT_GATEWAY_CODES } from './payment-gateway.constants';
import type { PaymentGateway } from './payment-gateway.port';
import { PaymentsService } from './payments.service';

describe('PaymentsService multi-gateway routing', () => {
  const userId = '10000000-0000-4000-8000-000000000001';
  const orderId = '20000000-0000-4000-8000-000000000001';
  const paymentId = '30000000-0000-4000-8000-000000000001';
  const attemptId = '40000000-0000-4000-8000-000000000001';

  const prisma = {
    paymentAttempt: {
      update: jest.fn(),
      updateMany: jest.fn(),
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const config = {
    get: jest.fn().mockReturnValue('https://api.example.com/api/v1/payments/callback'),
  };

  const registryGateway: jest.Mocked<PaymentGateway> = {
    providerCode: 'registry',
    initiate: jest.fn(),
    verify: jest.fn(),
  };

  let service: PaymentsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PaymentsService(
      prisma as unknown as PrismaService,
      config as unknown as ConfigService,
      registryGateway,
    );
  });

  it('stores the selected provider and passes it to the registry boundary', async () => {
    const transaction = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: orderId }]),
      order: {
        findFirst: jest.fn().mockResolvedValue({
          id: orderId,
          orderNumber: 'HS-TEST',
          status: 'PENDING_PAYMENT',
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
          provider: PAYMENT_GATEWAY_CODES.ZIBAL,
          amountToman: 1_000_000,
          authority: null,
          paymentUrl: null,
          status: PaymentAttemptStatus.CREATED,
        }),
      },
    };

    prisma.$transaction.mockImplementation(
      async (callback: (client: typeof transaction) => Promise<unknown>) => callback(transaction),
    );
    registryGateway.initiate.mockResolvedValue({
      authority: 'TRACK-1',
      paymentUrl: 'https://gateway.example/TRACK-1',
    });
    prisma.paymentAttempt.update.mockResolvedValue({
      id: attemptId,
      status: PaymentAttemptStatus.REDIRECTED,
      authority: 'TRACK-1',
      paymentUrl: 'https://gateway.example/TRACK-1',
    });

    await service.initiateOrderPayment(userId, orderId, {
      provider: PAYMENT_GATEWAY_CODES.ZIBAL,
      idempotencyKey: 'checkout-zibal-001',
    });

    expect(transaction.$queryRaw).toHaveBeenCalledTimes(1);
    expect(transaction.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      transaction.order.findFirst.mock.invocationCallOrder[0],
    );

    expect(transaction.paymentAttempt.create).toHaveBeenCalledWith({
      data: {
        paymentId,
        idempotencyKey: 'checkout-zibal-001',
        provider: PAYMENT_GATEWAY_CODES.ZIBAL,
        amountToman: 1_000_000,
      },
    });

    expect(registryGateway.initiate).toHaveBeenCalledWith({
      provider: PAYMENT_GATEWAY_CODES.ZIBAL,
      attemptId,
      orderNumber: 'HS-TEST',
      amountRial: '10000000',
      callbackUrl: `https://api.example.com/api/v1/payments/callback/${attemptId}`,
    });
  });
});
