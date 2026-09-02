import { ConflictException } from '@nestjs/common';
import { OrderReturnDisposition, OrderReturnStatus } from '../../generated/prisma/enums';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import { OrderReturnsService } from './order-returns.service';

describe('OrderReturnsService terminal concurrency', () => {
  const actorUserId = '10000000-0000-4000-8000-000000000001';
  const returnId = '40000000-0000-4000-8000-000000000001';
  const returnItemId = '50000000-0000-4000-8000-000000000001';
  const orderItemId = '30000000-0000-4000-8000-000000000001';

  it('returns idempotently when another worker receives the return first', async () => {
    const received = {
      id: returnId,
      status: OrderReturnStatus.RECEIVED,
    };
    const transaction = {
      orderReturn: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({
            id: returnId,
            status: OrderReturnStatus.REQUESTED,
            order: {
              id: '20000000-0000-4000-8000-000000000001',
              warehouseId: '70000000-0000-4000-8000-000000000001',
            },
            items: [
              {
                id: returnItemId,
                quantity: 1,
                orderItem: {
                  id: orderItemId,
                  variantId: '60000000-0000-4000-8000-000000000001',
                  quantity: 1,
                  returnedQuantity: 0,
                  returnAllocatedQuantity: 1,
                },
              },
            ],
          })
          .mockResolvedValueOnce({
            status: OrderReturnStatus.RECEIVED,
          }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue(received),
      },
      orderItem: {
        updateMany: jest.fn(),
      },
      orderReturnItem: {
        update: jest.fn(),
      },
      inventory: {
        findUnique: jest.fn(),
        updateMany: jest.fn(),
      },
      inventoryMovement: {
        create: jest.fn(),
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

    await expect(
      service.receive(returnId, actorUserId, {
        items: [
          {
            returnItemId,
            disposition: OrderReturnDisposition.RESTOCK,
          },
        ],
      }),
    ).resolves.toBe(received);

    expect(transaction.orderItem.updateMany).not.toHaveBeenCalled();
    expect(transaction.orderReturnItem.update).not.toHaveBeenCalled();
    expect(transaction.inventoryMovement.create).not.toHaveBeenCalled();
    expect(transaction.supplierCredit.createMany).not.toHaveBeenCalled();
  });

  it('returns idempotently when another worker cancels the return first', async () => {
    const cancelled = {
      id: returnId,
      status: OrderReturnStatus.CANCELLED,
    };
    const transaction = {
      orderReturn: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({
            id: returnId,
            status: OrderReturnStatus.REQUESTED,
            items: [
              {
                id: returnItemId,
                orderItemId,
                quantity: 1,
              },
            ],
          })
          .mockResolvedValueOnce({
            status: OrderReturnStatus.CANCELLED,
          }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue(cancelled),
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
      service.cancel(returnId, actorUserId, {
        reason: 'Duplicate cancellation.',
      }),
    ).resolves.toBe(cancelled);

    expect(transaction.orderItem.updateMany).not.toHaveBeenCalled();
  });

  it('does not receive a return when cancellation wins the terminal-state race', async () => {
    const transaction = {
      orderReturn: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({
            id: returnId,
            status: OrderReturnStatus.REQUESTED,
            order: {
              id: '20000000-0000-4000-8000-000000000001',
              warehouseId: '70000000-0000-4000-8000-000000000001',
            },
            items: [
              {
                id: returnItemId,
                quantity: 1,
                orderItem: {
                  id: orderItemId,
                  variantId: '60000000-0000-4000-8000-000000000001',
                  quantity: 1,
                  returnedQuantity: 0,
                  returnAllocatedQuantity: 1,
                },
              },
            ],
          })
          .mockResolvedValueOnce({
            status: OrderReturnStatus.CANCELLED,
          }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findUniqueOrThrow: jest.fn(),
      },
      orderItem: {
        updateMany: jest.fn(),
      },
      orderReturnItem: {
        update: jest.fn(),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    };
    const service = new OrderReturnsService(prisma as unknown as PrismaService);

    await expect(
      service.receive(returnId, actorUserId, {
        items: [
          {
            returnItemId,
            disposition: OrderReturnDisposition.RESTOCK,
          },
        ],
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(transaction.orderItem.updateMany).not.toHaveBeenCalled();
    expect(transaction.orderReturnItem.update).not.toHaveBeenCalled();
  });

  it('requires returned quantity to remain covered by allocated return quantity', async () => {
    const transaction = {
      orderReturn: {
        findUnique: jest.fn().mockResolvedValue({
          id: returnId,
          status: OrderReturnStatus.REQUESTED,
          order: {
            id: '20000000-0000-4000-8000-000000000001',
            warehouseId: '70000000-0000-4000-8000-000000000001',
          },
          items: [
            {
              id: returnItemId,
              quantity: 1,
              orderItem: {
                id: orderItemId,
                variantId: '60000000-0000-4000-8000-000000000001',
                quantity: 2,
                returnedQuantity: 1,
                returnAllocatedQuantity: 2,
              },
            },
          ],
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn(),
      },
      orderItem: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      orderReturnItem: {
        update: jest.fn(),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    };
    const service = new OrderReturnsService(prisma as unknown as PrismaService);

    await expect(
      service.receive(returnId, actorUserId, {
        items: [
          {
            returnItemId,
            disposition: OrderReturnDisposition.RESTOCK,
          },
        ],
      }),
    ).rejects.toThrow('Returned quantity changed; reload and retry.');

    expect(transaction.orderItem.updateMany).toHaveBeenCalledWith({
      where: {
        id: orderItemId,
        returnedQuantity: {
          lte: 1,
        },
        returnAllocatedQuantity: {
          gte: 2,
        },
      },
      data: {
        returnedQuantity: {
          increment: 1,
        },
      },
    });
  });
});
