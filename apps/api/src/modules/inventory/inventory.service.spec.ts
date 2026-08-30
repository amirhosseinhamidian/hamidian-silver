import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import { InventoryService } from './inventory.service';

describe('InventoryService', () => {
  const actorUserId = '10000000-0000-4000-8000-000000000001';
  const warehouseId = '20000000-0000-4000-8000-000000000001';
  const variantId = '30000000-0000-4000-8000-000000000001';

  const prisma = {
    warehouse: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    inventory: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  let service: InventoryService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new InventoryService(prisma as unknown as PrismaService);
  });

  it('creates a default warehouse after clearing the previous default', async () => {
    const transaction = {
      warehouse: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        create: jest.fn().mockResolvedValue({
          id: warehouseId,
          code: 'MAIN',
          name: 'Main Warehouse',
          isDefault: true,
        }),
      },
    };

    prisma.$transaction.mockImplementation(
      async (callback: (client: typeof transaction) => Promise<unknown>) => callback(transaction),
    );

    await service.createWarehouse({
      code: 'MAIN',
      name: 'Main Warehouse',
      isDefault: true,
    });

    expect(transaction.warehouse.updateMany).toHaveBeenCalled();
    expect(transaction.warehouse.create).toHaveBeenCalledWith({
      data: {
        code: 'MAIN',
        name: 'Main Warehouse',
        isDefault: true,
        isActive: true,
      },
    });
  });

  it('creates inventory and movement for the first positive stock adjustment', async () => {
    const transaction = {
      warehouse: {
        findFirst: jest.fn().mockResolvedValue({ id: warehouseId }),
      },
      productVariant: {
        findFirst: jest.fn().mockResolvedValue({ id: variantId }),
      },
      inventory: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: '40000000-0000-4000-8000-000000000001',
          warehouseId,
          variantId,
          onHand: 10,
          reserved: 0,
          lowStockThreshold: 0,
        }),
      },
      inventoryMovement: {
        create: jest.fn().mockResolvedValue({}),
      },
    };

    prisma.$transaction.mockImplementation(
      async (callback: (client: typeof transaction) => Promise<unknown>) => callback(transaction),
    );

    await expect(
      service.adjustStock(
        {
          warehouseId,
          variantId,
          onHandDelta: 10,
          reason: 'Initial stock',
        },
        actorUserId,
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        onHand: 10,
        reserved: 0,
        available: 10,
        isLowStock: false,
      }),
    );

    expect(transaction.inventoryMovement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorUserId,
        onHandDelta: 10,
        reservedDelta: 0,
        onHandAfter: 10,
        reservedAfter: 0,
        reason: 'Initial stock',
      }),
    });
  });

  it('rejects reducing on-hand stock below reserved stock', async () => {
    const transaction = {
      warehouse: {
        findFirst: jest.fn().mockResolvedValue({ id: warehouseId }),
      },
      productVariant: {
        findFirst: jest.fn().mockResolvedValue({ id: variantId }),
      },
      inventory: {
        findUnique: jest.fn().mockResolvedValue({
          id: '40000000-0000-4000-8000-000000000001',
          warehouseId,
          variantId,
          onHand: 10,
          reserved: 4,
          lowStockThreshold: 2,
        }),
      },
    };

    prisma.$transaction.mockImplementation(
      async (callback: (client: typeof transaction) => Promise<unknown>) => callback(transaction),
    );

    await expect(
      service.adjustStock(
        {
          warehouseId,
          variantId,
          onHandDelta: -7,
        },
        actorUserId,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects bulk stock when one variant does not exist', async () => {
    const secondVariantId = '30000000-0000-4000-8000-000000000002';
    const transaction = {
      warehouse: {
        findFirst: jest.fn().mockResolvedValue({ id: warehouseId }),
      },
      productVariant: {
        findMany: jest.fn().mockResolvedValue([{ id: variantId }]),
      },
    };

    prisma.$transaction.mockImplementation(
      async (callback: (client: typeof transaction) => Promise<unknown>) => callback(transaction),
    );

    await expect(
      service.bulkSetStock(
        {
          warehouseId,
          variantIds: [variantId, secondVariantId],
          onHand: 8,
        },
        actorUserId,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('bulk-sets the same quantity while keeping inventory per variant', async () => {
    const secondVariantId = '30000000-0000-4000-8000-000000000002';

    const transaction = {
      warehouse: {
        findFirst: jest.fn().mockResolvedValue({ id: warehouseId }),
      },
      productVariant: {
        findMany: jest.fn().mockResolvedValue([{ id: variantId }, { id: secondVariantId }]),
      },
      inventory: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({
            id: '40000000-0000-4000-8000-000000000001',
            warehouseId,
            variantId,
            onHand: 2,
            reserved: 0,
            lowStockThreshold: 0,
          })
          .mockResolvedValueOnce(null),
        upsert: jest
          .fn()
          .mockResolvedValueOnce({
            id: '40000000-0000-4000-8000-000000000001',
            warehouseId,
            variantId,
            onHand: 8,
            reserved: 0,
            lowStockThreshold: 0,
          })
          .mockResolvedValueOnce({
            id: '40000000-0000-4000-8000-000000000002',
            warehouseId,
            variantId: secondVariantId,
            onHand: 8,
            reserved: 0,
            lowStockThreshold: 0,
          }),
        findMany: jest.fn().mockResolvedValue([
          {
            id: '40000000-0000-4000-8000-000000000001',
            warehouseId,
            variantId,
            onHand: 8,
            reserved: 0,
            lowStockThreshold: 0,
          },
          {
            id: '40000000-0000-4000-8000-000000000002',
            warehouseId,
            variantId: secondVariantId,
            onHand: 8,
            reserved: 0,
            lowStockThreshold: 0,
          },
        ]),
      },
      inventoryMovement: {
        create: jest.fn().mockResolvedValue({}),
      },
    };

    prisma.$transaction.mockImplementation(
      async (callback: (client: typeof transaction) => Promise<unknown>) => callback(transaction),
    );

    const result = await service.bulkSetStock(
      {
        warehouseId,
        variantIds: [variantId, secondVariantId],
        onHand: 8,
      },
      actorUserId,
    );

    expect(result).toHaveLength(2);
    expect(result.every((item) => item.onHand === 8)).toBe(true);
    expect(transaction.inventory.upsert).toHaveBeenCalledTimes(2);
    expect(transaction.inventoryMovement.create).toHaveBeenCalledTimes(2);
  });

  it('computes available and low-stock status when listing inventory', async () => {
    prisma.inventory.findMany.mockResolvedValue([
      {
        id: '40000000-0000-4000-8000-000000000001',
        warehouseId,
        variantId,
        onHand: 10,
        reserved: 7,
        lowStockThreshold: 3,
        warehouse: {
          id: warehouseId,
          name: 'Main Warehouse',
        },
        variant: {
          id: variantId,
        },
      },
    ]);

    await expect(service.listStock({ warehouseId })).resolves.toEqual([
      expect.objectContaining({
        available: 3,
        isLowStock: true,
      }),
    ]);
  });
});
