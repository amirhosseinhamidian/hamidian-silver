import { ConflictException } from '@nestjs/common';
import { OrderStatus, PaymentStatus } from '../../generated/prisma/enums';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import { OrderExpirationService } from './order-expiration.service';

describe('OrderExpirationService payment concurrency', () => {
  const now = new Date('2026-08-31T13:30:00.000Z');
  const orderId = '10000000-0000-4000-8000-000000000001';
  const warehouseId = '20000000-0000-4000-8000-000000000001';

  function createService(transaction: Record<string, unknown>) {
    const prisma = {
      $transaction: jest.fn(async (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    };

    return new OrderExpirationService(prisma as unknown as PrismaService);
  }

  it('does not expire when the payment snapshot is already protected', async () => {
    const transaction = {
      order: {
        findUnique: jest.fn().mockResolvedValue({
          id: orderId,
          warehouseId,
          status: OrderStatus.PENDING_PAYMENT,
          reservationExpiresAt: new Date(now.getTime() - 1_000),
          payment: {
            status: PaymentStatus.PAID,
          },
          items: [],
        }),
        updateMany: jest.fn(),
      },
      inventory: {
        findUnique: jest.fn(),
        updateMany: jest.fn(),
      },
      payment: {
        updateMany: jest.fn(),
        findUnique: jest.fn(),
      },
      orderStatusHistory: {
        create: jest.fn(),
      },
    };
    const service = createService(transaction);

    await expect(service.expireOrder(orderId, now)).resolves.toBe(false);

    expect(transaction.order.updateMany).not.toHaveBeenCalled();
    expect(transaction.payment.updateMany).not.toHaveBeenCalled();
  });

  it('includes the payment snapshot in the order expiration CAS', async () => {
    const transaction = {
      order: {
        findUnique: jest.fn().mockResolvedValue({
          id: orderId,
          warehouseId,
          status: OrderStatus.PENDING_PAYMENT,
          reservationExpiresAt: new Date(now.getTime() - 1_000),
          payment: {
            status: PaymentStatus.PENDING,
          },
          items: [],
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      inventory: {
        findUnique: jest.fn(),
        updateMany: jest.fn(),
      },
      payment: {
        updateMany: jest.fn(),
        findUnique: jest.fn(),
      },
      orderStatusHistory: {
        create: jest.fn(),
      },
    };
    const service = createService(transaction);

    await expect(service.expireOrder(orderId, now)).resolves.toBe(false);

    expect(transaction.order.updateMany).toHaveBeenCalledWith({
      where: {
        id: orderId,
        status: OrderStatus.PENDING_PAYMENT,
        reservationExpiresAt: {
          lte: now,
        },
        payment: {
          is: {
            status: PaymentStatus.PENDING,
          },
        },
      },
      data: {
        status: OrderStatus.EXPIRED,
      },
    });
    expect(transaction.payment.updateMany).not.toHaveBeenCalled();
  });

  it('allows a concurrent reconciliation after expiration claims the order', async () => {
    const transaction = {
      order: {
        findUnique: jest.fn().mockResolvedValue({
          id: orderId,
          warehouseId,
          status: OrderStatus.PENDING_PAYMENT,
          reservationExpiresAt: new Date(now.getTime() - 1_000),
          payment: {
            status: PaymentStatus.PENDING,
          },
          items: [],
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      inventory: {
        findUnique: jest.fn(),
        updateMany: jest.fn(),
      },
      inventoryMovement: {
        create: jest.fn(),
      },
      payment: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findUnique: jest.fn().mockResolvedValue({
          status: PaymentStatus.RECONCILIATION_REQUIRED,
        }),
      },
      orderStatusHistory: {
        create: jest.fn().mockResolvedValue({}),
      },
    };
    const service = createService(transaction);

    await expect(service.expireOrder(orderId, now)).resolves.toBe(true);

    expect(transaction.payment.findUnique).toHaveBeenCalledWith({
      where: {
        orderId,
      },
      select: {
        status: true,
      },
    });
    expect(transaction.orderStatusHistory.create).toHaveBeenCalled();
  });

  it('rolls back expiration when payment becomes paid after the order claim', async () => {
    const transaction = {
      order: {
        findUnique: jest.fn().mockResolvedValue({
          id: orderId,
          warehouseId,
          status: OrderStatus.PENDING_PAYMENT,
          reservationExpiresAt: new Date(now.getTime() - 1_000),
          payment: {
            status: PaymentStatus.PENDING,
          },
          items: [],
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      inventory: {
        findUnique: jest.fn(),
        updateMany: jest.fn(),
      },
      inventoryMovement: {
        create: jest.fn(),
      },
      payment: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findUnique: jest.fn().mockResolvedValue({
          status: PaymentStatus.PAID,
        }),
      },
      orderStatusHistory: {
        create: jest.fn(),
      },
    };
    const service = createService(transaction);

    await expect(service.expireOrder(orderId, now)).rejects.toBeInstanceOf(ConflictException);

    expect(transaction.orderStatusHistory.create).not.toHaveBeenCalled();
  });
});
