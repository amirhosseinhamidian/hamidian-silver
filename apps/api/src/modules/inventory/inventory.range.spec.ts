import { ErrorCode } from '../../common/errors/error-codes';
import { INT32_MAX } from '../../common/int32';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import { InventoryService } from './inventory.service';

describe('InventoryService PostgreSQL Int32 range', () => {
  const actorUserId = '10000000-0000-4000-8000-000000000001';
  const warehouseId = '20000000-0000-4000-8000-000000000001';
  const variantId = '30000000-0000-4000-8000-000000000001';

  it('rejects an adjustment whose resulting on-hand stock would overflow PostgreSQL Int', async () => {
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
          onHand: INT32_MAX,
          reserved: 0,
          lowStockThreshold: 0,
        }),
        update: jest.fn(),
      },
      inventoryMovement: {
        create: jest.fn(),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    };
    const service = new InventoryService(prisma as unknown as PrismaService);

    await expect(
      service.adjustStock(
        {
          warehouseId,
          variantId,
          onHandDelta: 1,
        },
        actorUserId,
      ),
    ).rejects.toMatchObject({
      name: 'DomainException',
      code: ErrorCode.INVENTORY_NOT_AVAILABLE,
    });

    expect(transaction.inventory.update).not.toHaveBeenCalled();
    expect(transaction.inventoryMovement.create).not.toHaveBeenCalled();
  });

  it('rejects a direct bulk-set value outside PostgreSQL Int range before opening a transaction', async () => {
    const prisma = {
      $transaction: jest.fn(),
    };
    const service = new InventoryService(prisma as unknown as PrismaService);

    await expect(
      service.bulkSetStock(
        {
          warehouseId,
          variantIds: [variantId],
          onHand: INT32_MAX + 1,
        },
        actorUserId,
      ),
    ).rejects.toMatchObject({
      name: 'DomainException',
      code: ErrorCode.INVENTORY_NOT_AVAILABLE,
    });

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
