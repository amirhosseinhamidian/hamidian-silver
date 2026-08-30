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
});
