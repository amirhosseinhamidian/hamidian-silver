import { ConflictException } from '@nestjs/common';
import { OrderReturnDisposition, OrderReturnStatus } from '../../generated/prisma/enums';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import { OrderReturnsService } from './order-returns.service';

describe('OrderReturnsService supplier credit integrity', () => {
  const actorUserId = '10000000-0000-4000-8000-000000000001';
  const orderId = '20000000-0000-4000-8000-000000000001';
  const orderItemId = '30000000-0000-4000-8000-000000000001';
  const returnId = '40000000-0000-4000-8000-000000000001';
  const returnItemId = '50000000-0000-4000-8000-000000000001';
  const supplierId = '60000000-0000-4000-8000-000000000001';

  function createTransaction(existingCredit: unknown) {
    return {
      orderReturn: {
        findUnique: jest.fn().mockResolvedValue({
          id: returnId,
          status: OrderReturnStatus.REQUESTED,
          order: {
            id: orderId,
            warehouseId: '70000000-0000-4000-8000-000000000001',
          },
          items: [
            {
              id: returnItemId,
              quantity: 2,
              orderItem: {
                id: orderItemId,
                variantId: '80000000-0000-4000-8000-000000000001',
                quantity: 2,
                returnedQuantity: 0,
                returnAllocatedQuantity: 2,
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
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
        findUnique: jest.fn().mockResolvedValue(existingCredit),
      },
    };
  }

  function createService(transaction: ReturnType<typeof createTransaction>) {
    const prisma = {
      $transaction: jest.fn(async (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    };

    return new OrderReturnsService(prisma as unknown as PrismaService);
  }

  it('accepts an exact existing credit when a duplicate insert is skipped', async () => {
    const existingCredit = {
      id: '90000000-0000-4000-8000-000000000001',
      orderId,
      orderItemId,
      returnItemId,
      supplierIdSnapshot: supplierId,
      supplierNameSnapshot: 'Supplier A',
      quantity: 2,
      unitSupplierPriceToman: 350_000,
      amountToman: 700_000,
    };
    const transaction = createTransaction(existingCredit);
    const service = createService(transaction);

    await expect(
      service.receive(returnId, actorUserId, {
        items: [
          {
            returnItemId,
            disposition: OrderReturnDisposition.RETURN_TO_SUPPLIER,
          },
        ],
      }),
    ).resolves.toEqual({
      id: returnId,
      status: OrderReturnStatus.RECEIVED,
    });

    expect(transaction.supplierCredit.findUnique).toHaveBeenCalledWith({
      where: {
        returnItemId,
      },
    });
  });

  it('rolls back receive when an existing credit has different immutable economics', async () => {
    const transaction = createTransaction({
      id: '90000000-0000-4000-8000-000000000001',
      orderId,
      orderItemId,
      returnItemId,
      supplierIdSnapshot: supplierId,
      supplierNameSnapshot: 'Supplier A',
      quantity: 2,
      unitSupplierPriceToman: 350_000,
      amountToman: 650_000,
    });
    const service = createService(transaction);

    await expect(
      service.receive(returnId, actorUserId, {
        items: [
          {
            returnItemId,
            disposition: OrderReturnDisposition.RETURN_TO_SUPPLIER,
          },
        ],
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(transaction.orderReturn.findUniqueOrThrow).not.toHaveBeenCalled();
    expect(transaction.inventoryMovement.create).not.toHaveBeenCalled();
  });

  it('rolls back receive when a skipped duplicate cannot be resolved by return item', async () => {
    const transaction = createTransaction(null);
    const service = createService(transaction);

    await expect(
      service.receive(returnId, actorUserId, {
        items: [
          {
            returnItemId,
            disposition: OrderReturnDisposition.RETURN_TO_SUPPLIER,
          },
        ],
      }),
    ).rejects.toThrow('Existing supplier credit does not match the received return item.');

    expect(transaction.orderReturn.findUniqueOrThrow).not.toHaveBeenCalled();
  });
});
