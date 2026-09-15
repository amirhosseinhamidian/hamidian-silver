import {
  InventoryMovementType,
  OrderReturnDisposition,
  OrderReturnStatus,
  OrderStatus,
} from '../../generated/prisma/enums';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import { OrderReturnsService } from './order-returns.service';

describe('OrderReturnsService', () => {
  const actorUserId = '10000000-0000-4000-8000-000000000001';
  const orderId = '20000000-0000-4000-8000-000000000001';
  const orderItemId = '30000000-0000-4000-8000-000000000001';
  const returnId = '40000000-0000-4000-8000-000000000001';
  const returnItemId = '50000000-0000-4000-8000-000000000001';
  const variantId = '60000000-0000-4000-8000-000000000001';
  const warehouseId = '70000000-0000-4000-8000-000000000001';

  it('lists the newest return requests with an optional status filter', async () => {
    const prisma = {
      orderReturn: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const service = new OrderReturnsService(prisma as unknown as PrismaService);

    await expect(service.list({ status: OrderReturnStatus.REQUESTED, limit: 25 })).resolves.toEqual(
      [],
    );
    expect(prisma.orderReturn.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: OrderReturnStatus.REQUESTED },
        take: 25,
        orderBy: { createdAt: 'desc' },
      }),
    );
  });

  it('authorizes returns for a delivered order after an admin review', async () => {
    const authorizedAt = new Date('2026-09-06T13:00:00.000Z');
    jest.useFakeTimers().setSystemTime(authorizedAt);
    const prisma = {
      order: {
        findUnique: jest.fn().mockResolvedValue({
          id: orderId,
          status: OrderStatus.DELIVERED,
        }),
        update: jest.fn().mockResolvedValue({ id: orderId }),
      },
    };
    const service = new OrderReturnsService(prisma as unknown as PrismaService);

    try {
      await expect(
        service.authorizeReturn(orderId, actorUserId, {
          reason: 'Wrong item shipment confirmed by support.',
        }),
      ).resolves.toEqual({
        orderId,
        authorizedAt,
        reason: 'Wrong item shipment confirmed by support.',
      });

      expect(prisma.order.update).toHaveBeenCalledWith({
        where: { id: orderId },
        data: {
          returnAuthorizedAt: authorizedAt,
          returnAuthorizedByUserId: actorUserId,
          returnAuthorizationReason: 'Wrong item shipment confirmed by support.',
        },
        select: { id: true },
      });
    } finally {
      jest.useRealTimers();
    }
  });

  it('atomically reserves return quantity when a return is created', async () => {
    const transaction = {
      order: {
        findUnique: jest.fn().mockResolvedValue({
          id: orderId,
          status: OrderStatus.DELIVERED,
          items: [
            {
              id: orderItemId,
              quantity: 3,
              returnAllocatedQuantity: 1,
            },
          ],
        }),
      },
      orderItem: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      orderReturn: {
        create: jest.fn().mockResolvedValue({
          id: returnId,
          status: OrderReturnStatus.REQUESTED,
        }),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    };
    const service = new OrderReturnsService(prisma as unknown as PrismaService);

    await service.create(orderId, actorUserId, {
      items: [
        {
          orderItemId,
          quantity: 2,
        },
      ],
    });

    expect(transaction.orderItem.updateMany).toHaveBeenCalledWith({
      where: {
        id: orderItemId,
        orderId,
        returnAllocatedQuantity: {
          lte: 1,
        },
      },
      data: {
        returnAllocatedQuantity: {
          increment: 2,
        },
      },
    });
  });

  it('creates a sanitized return request for the customer who owns the order', async () => {
    const createdAt = new Date('2026-09-06T12:00:00.000Z');
    const orderReturn = {
      id: returnId,
      orderId,
      status: OrderReturnStatus.REQUESTED,
      reason: 'Wrong item shipment.',
      receivedAt: null,
      cancelledAt: null,
      createdAt,
      updatedAt: createdAt,
      items: [
        {
          id: returnItemId,
          orderItemId,
          quantity: 1,
          disposition: null,
          createdAt,
          updatedAt: createdAt,
          orderItem: { supplierNameSnapshot: 'Internal supplier' },
        },
      ],
      requestedBy: { id: actorUserId, phone: '09123456789' },
    };
    const transaction = {
      order: {
        findUnique: jest.fn().mockResolvedValue({
          id: orderId,
          userId: actorUserId,
          status: OrderStatus.DELIVERED,
          returnAuthorizedAt: createdAt,
          items: [{ id: orderItemId, quantity: 2, returnAllocatedQuantity: 0 }],
        }),
      },
      orderItem: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      orderReturn: {
        create: jest.fn().mockResolvedValue(orderReturn),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    };
    const service = new OrderReturnsService(prisma as unknown as PrismaService);

    const result = await service.createMyReturn(actorUserId, orderId, {
      items: [{ orderItemId, quantity: 1 }],
      reason: 'Wrong item shipment.',
    });

    expect(result).toEqual({
      id: returnId,
      orderId,
      status: OrderReturnStatus.REQUESTED,
      reason: 'Wrong item shipment.',
      receivedAt: null,
      cancelledAt: null,
      createdAt,
      updatedAt: createdAt,
      items: [
        expect.objectContaining({
          id: returnItemId,
          orderItemId,
          quantity: 1,
        }),
      ],
    });
    expect(result).not.toHaveProperty('requestedBy');
    expect(result.items[0]).not.toHaveProperty('orderItem');
  });

  it('rejects a customer return request until an admin authorizes the order', async () => {
    const transaction = {
      order: {
        findUnique: jest.fn().mockResolvedValue({
          id: orderId,
          userId: actorUserId,
          status: OrderStatus.DELIVERED,
          returnAuthorizedAt: null,
          items: [{ id: orderItemId, quantity: 1, returnAllocatedQuantity: 0 }],
        }),
      },
      orderItem: {
        updateMany: jest.fn(),
      },
      orderReturn: {
        create: jest.fn(),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    };
    const service = new OrderReturnsService(prisma as unknown as PrismaService);

    await expect(
      service.createMyReturn(actorUserId, orderId, {
        items: [{ orderItemId, quantity: 1 }],
        reason: 'Wrong item shipment.',
      }),
    ).rejects.toMatchObject({ status: 403 });

    expect(transaction.orderItem.updateMany).not.toHaveBeenCalled();
    expect(transaction.orderReturn.create).not.toHaveBeenCalled();
  });

  it("does not create a return request for another customer's order", async () => {
    const transaction = {
      order: {
        findUnique: jest.fn().mockResolvedValue({
          id: orderId,
          userId: '10000000-0000-4000-8000-000000000002',
          status: OrderStatus.DELIVERED,
          items: [{ id: orderItemId, quantity: 1, returnAllocatedQuantity: 0 }],
        }),
      },
      orderItem: {
        updateMany: jest.fn(),
      },
      orderReturn: {
        create: jest.fn(),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    };
    const service = new OrderReturnsService(prisma as unknown as PrismaService);

    await expect(
      service.createMyReturn(actorUserId, orderId, {
        items: [{ orderItemId, quantity: 1 }],
      }),
    ).rejects.toMatchObject({ status: 404 });

    expect(transaction.orderItem.updateMany).not.toHaveBeenCalled();
    expect(transaction.orderReturn.create).not.toHaveBeenCalled();
  });

  it('restocks a received return with a RETURN inventory movement', async () => {
    const transaction = {
      orderReturn: {
        findUnique: jest.fn().mockResolvedValue({
          id: returnId,
          status: OrderReturnStatus.REQUESTED,
          order: {
            id: orderId,
            warehouseId,
          },
          items: [
            {
              id: returnItemId,
              quantity: 1,
              orderItem: {
                id: orderItemId,
                variantId,
                quantity: 2,
                returnedQuantity: 0,
                supplierIdSnapshot: null,
                supplierNameSnapshot: null,
                unitSupplierPriceToman: null,
              },
            },
          ],
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: returnId,
          status: OrderReturnStatus.RECEIVED,
        }),
      },
      orderItem: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      orderReturnItem: {
        update: jest.fn().mockResolvedValue({}),
      },
      inventory: {
        findUnique: jest.fn().mockResolvedValue({
          id: '80000000-0000-4000-8000-000000000001',
          onHand: 4,
          reserved: 0,
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      inventoryMovement: {
        create: jest.fn().mockResolvedValue({}),
      },
      supplierCredit: {
        createMany: jest.fn(),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    };
    const service = new OrderReturnsService(prisma as unknown as PrismaService);

    await service.receive(returnId, actorUserId, {
      items: [
        {
          returnItemId,
          disposition: OrderReturnDisposition.RESTOCK,
        },
      ],
    });

    expect(transaction.inventoryMovement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: InventoryMovementType.RETURN,
        onHandDelta: 1,
        reservedDelta: 0,
        onHandAfter: 5,
        referenceType: 'ORDER_RETURN_ITEM',
        referenceId: returnItemId,
      }),
    });
    expect(transaction.supplierCredit.createMany).not.toHaveBeenCalled();
  });

  it('creates supplier credit from immutable order-item supplier snapshots', async () => {
    const supplierId = '90000000-0000-4000-8000-000000000001';
    const transaction = {
      orderReturn: {
        findUnique: jest.fn().mockResolvedValue({
          id: returnId,
          status: OrderReturnStatus.REQUESTED,
          order: {
            id: orderId,
            warehouseId,
          },
          items: [
            {
              id: returnItemId,
              quantity: 2,
              orderItem: {
                id: orderItemId,
                variantId,
                quantity: 2,
                returnedQuantity: 0,
                supplierIdSnapshot: supplierId,
                supplierNameSnapshot: 'Supplier A',
                unitSupplierPriceToman: 350_000,
              },
            },
          ],
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: returnId,
          status: OrderReturnStatus.RECEIVED,
        }),
      },
      orderItem: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      orderReturnItem: {
        update: jest.fn().mockResolvedValue({}),
      },
      inventory: {
        findUnique: jest.fn(),
        updateMany: jest.fn(),
      },
      inventoryMovement: {
        create: jest.fn(),
      },
      supplierCredit: {
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    };
    const service = new OrderReturnsService(prisma as unknown as PrismaService);

    await service.receive(returnId, actorUserId, {
      items: [
        {
          returnItemId,
          disposition: OrderReturnDisposition.RETURN_TO_SUPPLIER,
        },
      ],
    });

    expect(transaction.supplierCredit.createMany).toHaveBeenCalledWith({
      data: [
        {
          orderId,
          orderItemId,
          returnItemId,
          supplierIdSnapshot: supplierId,
          supplierNameSnapshot: 'Supplier A',
          quantity: 2,
          unitSupplierPriceToman: 350_000,
          amountToman: 700_000,
          createdByUserId: actorUserId,
        },
      ],
      skipDuplicates: true,
    });
    expect(transaction.inventoryMovement.create).not.toHaveBeenCalled();
  });

  it('releases return allocation when a requested return is cancelled', async () => {
    const transaction = {
      orderReturn: {
        findUnique: jest.fn().mockResolvedValue({
          id: returnId,
          status: OrderReturnStatus.REQUESTED,
          items: [
            {
              id: returnItemId,
              orderItemId,
              quantity: 2,
            },
          ],
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: returnId,
          status: OrderReturnStatus.CANCELLED,
        }),
      },
      orderItem: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    };
    const service = new OrderReturnsService(prisma as unknown as PrismaService);

    await service.cancel(returnId, actorUserId, {
      reason: 'Customer kept the item.',
    });

    expect(transaction.orderItem.updateMany).toHaveBeenCalledWith({
      where: {
        id: orderItemId,
        returnAllocatedQuantity: {
          gte: 2,
        },
      },
      data: {
        returnAllocatedQuantity: {
          decrement: 2,
        },
      },
    });
  });

  it('does not cancel a return request created by another customer', async () => {
    const transaction = {
      orderReturn: {
        findUnique: jest.fn().mockResolvedValue({
          id: returnId,
          requestedByUserId: '10000000-0000-4000-8000-000000000002',
          status: OrderReturnStatus.REQUESTED,
          order: { userId: actorUserId },
          items: [{ id: returnItemId, orderItemId, quantity: 1 }],
        }),
        updateMany: jest.fn(),
        findUniqueOrThrow: jest.fn(),
      },
      orderItem: {
        updateMany: jest.fn(),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    };
    const service = new OrderReturnsService(prisma as unknown as PrismaService);

    await expect(
      service.cancelMyReturn(actorUserId, returnId, { reason: 'Changed my mind' }),
    ).rejects.toMatchObject({ status: 404 });

    expect(transaction.orderReturn.updateMany).not.toHaveBeenCalled();
    expect(transaction.orderItem.updateMany).not.toHaveBeenCalled();
  });
});
