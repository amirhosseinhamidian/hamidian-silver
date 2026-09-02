import { BadRequestException } from '@nestjs/common';
import { INT32_MAX } from '../../common/int32';
import { OrderReturnDisposition, OrderReturnStatus } from '../../generated/prisma/enums';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import { OrderReturnsService } from './order-returns.service';

describe('OrderReturnsService PostgreSQL ranges', () => {
  it('rejects restock when returned inventory would overflow PostgreSQL Int', async () => {
    const returnId = '40000000-0000-4000-8000-000000000001';
    const returnItemId = '50000000-0000-4000-8000-000000000001';
    const orderItemId = '30000000-0000-4000-8000-000000000001';
    const orderId = '20000000-0000-4000-8000-000000000001';
    const warehouseId = '70000000-0000-4000-8000-000000000001';
    const variantId = '60000000-0000-4000-8000-000000000001';
    const actorUserId = '10000000-0000-4000-8000-000000000001';
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
                quantity: 1,
                returnedQuantity: 0,
                supplierIdSnapshot: null,
                supplierNameSnapshot: null,
                unitSupplierPriceToman: null,
              },
            },
          ],
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
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
          onHand: INT32_MAX,
          reserved: 0,
        }),
        updateMany: jest.fn(),
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
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(transaction.inventory.updateMany).not.toHaveBeenCalled();
    expect(transaction.inventoryMovement.create).not.toHaveBeenCalled();
  });
});
