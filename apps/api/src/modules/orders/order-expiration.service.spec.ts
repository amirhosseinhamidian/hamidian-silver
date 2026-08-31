import { ConflictException } from '@nestjs/common';
import { InventoryMovementType, OrderStatus, PaymentStatus } from '../../generated/prisma/enums';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import { OrderExpirationService } from './order-expiration.service';

describe('OrderExpirationService', () => {
  const now = new Date('2026-08-30T13:30:00.000Z');
  const orderId = '10000000-0000-4000-8000-000000000001';
  const warehouseId = '20000000-0000-4000-8000-000000000001';
  const variantId = '30000000-0000-4000-8000-000000000001';
  const inventoryId = '40000000-0000-4000-8000-000000000001';

  const prisma = {
    order: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  let service: OrderExpirationService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new OrderExpirationService(prisma as unknown as PrismaService);
  });

  it('expires a due order and releases its reserved inventory exactly once', async () => {
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
          items: [
            {
              variantId,
              quantity: 2,
            },
            {
              variantId,
              quantity: 1,
            },
          ],
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      inventory: {
        findUnique: jest.fn().mockResolvedValue({
          id: inventoryId,
          onHand: 10,
          reserved: 5,
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      inventoryMovement: {
        create: jest.fn().mockResolvedValue({}),
      },
      payment: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn(),
      },
      orderStatusHistory: {
        create: jest.fn().mockResolvedValue({}),
      },
    };

    prisma.$transaction.mockImplementation(
      async (callback: (client: typeof transaction) => Promise<unknown>) => callback(transaction),
    );

    await expect(service.expireOrder(orderId, now)).resolves.toBe(true);

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

    expect(transaction.inventory.updateMany).toHaveBeenCalledWith({
      where: {
        id: inventoryId,
        onHand: 10,
        reserved: 5,
      },
      data: {
        reserved: 2,
      },
    });

    expect(transaction.inventoryMovement.create).toHaveBeenCalledWith({
      data: {
        inventoryId,
        actorUserId: null,
        type: InventoryMovementType.RELEASE,
        onHandDelta: 0,
        reservedDelta: -3,
        onHandAfter: 10,
        reservedAfter: 2,
        reason: 'Order inventory reservation expired',
        referenceType: 'ORDER',
        referenceId: orderId,
      },
    });

    expect(transaction.payment.updateMany).toHaveBeenCalledWith({
      where: {
        orderId,
        status: PaymentStatus.PENDING,
      },
      data: {
        status: PaymentStatus.CANCELLED,
      },
    });

    expect(transaction.orderStatusHistory.create).toHaveBeenCalledWith({
      data: {
        orderId,
        actorUserId: null,
        fromStatus: OrderStatus.PENDING_PAYMENT,
        toStatus: OrderStatus.EXPIRED,
        reason: 'Inventory reservation expired',
      },
    });
  });

  it('is a no-op when another worker has already claimed the order', async () => {
    const transaction = {
      order: {
        findUnique: jest.fn().mockResolvedValue({
          id: orderId,
          warehouseId,
          status: OrderStatus.PENDING_PAYMENT,
          reservationExpiresAt: new Date(now.getTime() - 1_000),
          items: [{ variantId, quantity: 1 }],
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      inventory: {
        findUnique: jest.fn(),
        updateMany: jest.fn(),
      },
      inventoryMovement: {
        create: jest.fn(),
      },
      payment: {
        updateMany: jest.fn(),
      },
      orderStatusHistory: {
        create: jest.fn(),
      },
    };

    prisma.$transaction.mockImplementation(
      async (callback: (client: typeof transaction) => Promise<unknown>) => callback(transaction),
    );

    await expect(service.expireOrder(orderId, now)).resolves.toBe(false);

    expect(transaction.inventory.findUnique).not.toHaveBeenCalled();
    expect(transaction.payment.updateMany).not.toHaveBeenCalled();
    expect(transaction.orderStatusHistory.create).not.toHaveBeenCalled();
  });

  it('does not expire an order whose reservation is still valid', async () => {
    const transaction = {
      order: {
        findUnique: jest.fn().mockResolvedValue({
          id: orderId,
          warehouseId,
          status: OrderStatus.PENDING_PAYMENT,
          reservationExpiresAt: new Date(now.getTime() + 60_000),
          items: [{ variantId, quantity: 1 }],
        }),
        updateMany: jest.fn(),
      },
    };

    prisma.$transaction.mockImplementation(
      async (callback: (client: typeof transaction) => Promise<unknown>) => callback(transaction),
    );

    await expect(service.expireOrder(orderId, now)).resolves.toBe(false);
    expect(transaction.order.updateMany).not.toHaveBeenCalled();
  });

  it('rolls back expiration when reserved inventory is inconsistent', async () => {
    const transaction = {
      order: {
        findUnique: jest.fn().mockResolvedValue({
          id: orderId,
          warehouseId,
          status: OrderStatus.PENDING_PAYMENT,
          reservationExpiresAt: new Date(now.getTime() - 1_000),
          items: [{ variantId, quantity: 2 }],
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      inventory: {
        findUnique: jest.fn().mockResolvedValue({
          id: inventoryId,
          onHand: 10,
          reserved: 1,
        }),
        updateMany: jest.fn(),
      },
      inventoryMovement: {
        create: jest.fn(),
      },
      payment: {
        updateMany: jest.fn(),
      },
      orderStatusHistory: {
        create: jest.fn(),
      },
    };

    prisma.$transaction.mockImplementation(
      async (callback: (client: typeof transaction) => Promise<unknown>) => callback(transaction),
    );

    await expect(service.expireOrder(orderId, now)).rejects.toBeInstanceOf(ConflictException);

    expect(transaction.inventory.updateMany).not.toHaveBeenCalled();
    expect(transaction.payment.updateMany).not.toHaveBeenCalled();
  });

  it('processes due orders in bounded batches', async () => {
    prisma.order.findMany.mockResolvedValue([
      { id: orderId },
      { id: '50000000-0000-4000-8000-000000000001' },
    ]);

    const expireSpy = jest
      .spyOn(service, 'expireOrder')
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);

    await expect(service.expireDueOrders(now, 1_000)).resolves.toEqual({
      scanned: 2,
      expired: 1,
      skipped: 1,
    });

    expect(prisma.order.findMany).toHaveBeenCalledWith({
      where: {
        status: OrderStatus.PENDING_PAYMENT,
        reservationExpiresAt: {
          lte: now,
        },
      },
      orderBy: {
        reservationExpiresAt: 'asc',
      },
      take: 500,
      select: {
        id: true,
      },
    });

    expect(expireSpy).toHaveBeenNthCalledWith(1, orderId, now);
  });
});
