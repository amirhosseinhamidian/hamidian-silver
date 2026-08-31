import { ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrderStatus, PaymentAttemptStatus, PaymentStatus } from '../../generated/prisma/enums';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import type { PaymentGateway } from './payment-gateway.port';
import { PaymentsService } from './payments.service';

describe('PaymentsService', () => {
  const userId = '10000000-0000-4000-8000-000000000001';
  const orderId = '20000000-0000-4000-8000-000000000001';
  const paymentId = '30000000-0000-4000-8000-000000000001';
  const attemptId = '40000000-0000-4000-8000-000000000001';
  const inventoryId = '50000000-0000-4000-8000-000000000001';
  const variantId = '60000000-0000-4000-8000-000000000001';

  const prisma = {
    paymentAttempt: {
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    payment: {
      findFirst: jest.fn(),
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

  let service: PaymentsService;

  beforeEach(() => {
    jest.clearAllMocks();
    config.get.mockReturnValue('https://api.example.com/api/v1/payments/callback');
    service = new PaymentsService(
      prisma as unknown as PrismaService,
      config as unknown as ConfigService,
      gateway,
    );
  });

  it('initiates a payment using Rial only at the gateway boundary', async () => {
    const transaction = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: orderId }]),
      order: {
        findFirst: jest.fn().mockResolvedValue({
          id: orderId,
          orderNumber: 'HS-TEST',
          status: OrderStatus.PENDING_PAYMENT,
          grandTotalToman: 3_125_000,
          reservationExpiresAt: new Date(Date.now() + 60_000),
        }),
      },
      payment: {
        upsert: jest.fn().mockResolvedValue({
          id: paymentId,
          orderId,
          amountToman: 3_125_000,
        }),
      },
      paymentAttempt: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: attemptId,
          paymentId,
          amountToman: 3_125_000,
          authority: null,
          paymentUrl: null,
          status: PaymentAttemptStatus.CREATED,
        }),
      },
    };

    prisma.$transaction.mockImplementation(
      async (callback: (client: typeof transaction) => Promise<unknown>) => callback(transaction),
    );
    gateway.initiate.mockResolvedValue({
      authority: 'AUTH-1',
      paymentUrl: 'https://gateway.example/pay/AUTH-1',
    });
    prisma.paymentAttempt.updateMany.mockResolvedValue({ count: 1 });

    await service.initiateOrderPayment(userId, orderId, {
      idempotencyKey: 'checkout-12345678',
    });

    expect(transaction.$queryRaw).toHaveBeenCalledTimes(1);
    expect(transaction.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      transaction.order.findFirst.mock.invocationCallOrder[0],
    );

    expect(gateway.initiate).toHaveBeenCalledWith({
      attemptId,
      orderNumber: 'HS-TEST',
      amountRial: '31250000',
      callbackUrl: `https://api.example.com/api/v1/payments/callback/${attemptId}`,
    });
  });

  it('reuses an already redirected attempt for the same idempotency key', async () => {
    const transaction = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: orderId }]),
      order: {
        findFirst: jest.fn().mockResolvedValue({
          id: orderId,
          orderNumber: 'HS-TEST',
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
        findUnique: jest.fn().mockResolvedValue({
          id: attemptId,
          paymentId,
          amountToman: 1_000_000,
          authority: 'AUTH-1',
          paymentUrl: 'https://gateway.example/pay/AUTH-1',
          status: PaymentAttemptStatus.REDIRECTED,
        }),
      },
    };

    prisma.$transaction.mockImplementation(
      async (callback: (client: typeof transaction) => Promise<unknown>) => callback(transaction),
    );

    await expect(
      service.initiateOrderPayment(userId, orderId, {
        idempotencyKey: 'checkout-12345678',
      }),
    ).resolves.toEqual({
      attemptId,
      status: PaymentAttemptStatus.REDIRECTED,
      authority: 'AUTH-1',
      paymentUrl: 'https://gateway.example/pay/AUTH-1',
    });

    expect(gateway.initiate).not.toHaveBeenCalled();
  });

  it('verifies payment once and converts reserved inventory into a sale', async () => {
    prisma.paymentAttempt.findUnique.mockResolvedValue({
      id: attemptId,
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
    });

    gateway.verify.mockResolvedValue({
      success: true,
      referenceId: 'REF-1',
    });

    const transaction = {
      paymentAttempt: {
        findUnique: jest.fn().mockResolvedValue({
          id: attemptId,
          paymentId,
          authority: 'AUTH-1',
          status: PaymentAttemptStatus.REDIRECTED,
          providerReference: null,
          payment: {
            id: paymentId,
            status: PaymentStatus.PENDING,
            order: {
              id: orderId,
              warehouseId: '70000000-0000-4000-8000-000000000001',
              status: OrderStatus.PENDING_PAYMENT,
              items: [{ variantId, quantity: 2 }],
            },
          },
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      order: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn(),
      },
      inventory: {
        findUnique: jest.fn().mockResolvedValue({
          id: inventoryId,
          onHand: 10,
          reserved: 4,
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      inventoryMovement: {
        create: jest.fn().mockResolvedValue({}),
      },
      orderStatusHistory: {
        create: jest.fn().mockResolvedValue({}),
      },
      payment: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };

    prisma.$transaction.mockImplementation(
      async (callback: (client: typeof transaction) => Promise<unknown>) => callback(transaction),
    );

    await expect(service.verifyCallback(attemptId, 'AUTH-1')).resolves.toEqual({
      success: true,
      alreadyVerified: false,
      orderId,
      referenceId: 'REF-1',
    });

    expect(gateway.verify).toHaveBeenCalledWith({
      authority: 'AUTH-1',
      amountRial: '10000000',
    });

    expect(transaction.inventory.updateMany).toHaveBeenCalledWith({
      where: {
        id: inventoryId,
        onHand: 10,
        reserved: 4,
      },
      data: {
        onHand: 8,
        reserved: 2,
      },
    });

    expect(transaction.inventoryMovement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        inventoryId,
        onHandDelta: -2,
        reservedDelta: -2,
        onHandAfter: 8,
        reservedAfter: 2,
        referenceType: 'ORDER',
        referenceId: orderId,
      }),
    });

    expect(transaction.paymentAttempt.updateMany).toHaveBeenCalledWith({
      where: {
        id: attemptId,
        status: PaymentAttemptStatus.REDIRECTED,
      },
      data: expect.objectContaining({
        status: PaymentAttemptStatus.VERIFIED,
        providerReference: 'REF-1',
        verifiedAt: expect.any(Date),
      }),
    });
    expect(transaction.payment.updateMany).toHaveBeenCalledWith({
      where: {
        id: paymentId,
        status: PaymentStatus.PENDING,
      },
      data: {
        status: PaymentStatus.PAID,
        paidAt: expect.any(Date),
      },
    });
  });

  it('does not sell inventory again when a verified callback is repeated', async () => {
    prisma.paymentAttempt.findUnique.mockResolvedValue({
      id: attemptId,
      amountToman: 1_000_000,
      authority: 'AUTH-1',
      status: PaymentAttemptStatus.VERIFIED,
      providerReference: 'REF-1',
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

    await expect(service.verifyCallback(attemptId, 'AUTH-1')).resolves.toEqual({
      success: true,
      alreadyVerified: true,
      orderId,
      referenceId: 'REF-1',
    });

    expect(gateway.verify).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects payment initiation after the inventory reservation expires', async () => {
    const transaction = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: orderId }]),
      order: {
        findFirst: jest.fn().mockResolvedValue({
          id: orderId,
          orderNumber: 'HS-TEST',
          status: OrderStatus.PENDING_PAYMENT,
          grandTotalToman: 1_000_000,
          reservationExpiresAt: new Date(Date.now() - 1_000),
        }),
      },
      payment: {
        upsert: jest.fn(),
      },
      paymentAttempt: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
    };

    prisma.$transaction.mockImplementation(
      async (callback: (client: typeof transaction) => Promise<unknown>) => callback(transaction),
    );

    await expect(
      service.initiateOrderPayment(userId, orderId, {
        idempotencyKey: 'checkout-expired',
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(transaction.$queryRaw).toHaveBeenCalledTimes(1);
    expect(transaction.payment.upsert).not.toHaveBeenCalled();
    expect(gateway.initiate).not.toHaveBeenCalled();
  });
});
