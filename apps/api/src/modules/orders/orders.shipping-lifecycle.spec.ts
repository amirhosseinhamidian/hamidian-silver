import { ErrorCode } from '../../common/errors/error-codes';
import { OrderStatus, ShipmentStatus } from '../../generated/prisma/enums';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import { OrdersService } from './orders.service';

describe('OrdersService shipping lifecycle guards', () => {
  it('does not allow SHIPPED before the shipment is handed over', async () => {
    const orderId = '10000000-0000-4000-8000-000000000001';
    const transaction = {
      order: {
        findUnique: jest.fn().mockResolvedValue({
          id: orderId,
          status: OrderStatus.PROCESSING,
          deliveredAt: null,
          shipment: {
            status: ShipmentStatus.READY,
          },
        }),
        update: jest.fn(),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    };
    const service = new OrdersService(prisma as unknown as PrismaService);

    await expect(
      service.updateStatus(
        orderId,
        {
          status: OrderStatus.SHIPPED,
        },
        '20000000-0000-4000-8000-000000000001',
      ),
    ).rejects.toMatchObject({
      name: 'DomainException',
      code: ErrorCode.ORDER_SHIPMENT_NOT_READY,
    });

    expect(transaction.order.update).not.toHaveBeenCalled();
  });

  it('does not allow DELIVERED before the shipment is delivered', async () => {
    const orderId = '10000000-0000-4000-8000-000000000001';
    const transaction = {
      order: {
        findUnique: jest.fn().mockResolvedValue({
          id: orderId,
          status: OrderStatus.SHIPPED,
          deliveredAt: null,
          shipment: {
            status: ShipmentStatus.IN_TRANSIT,
          },
        }),
        update: jest.fn(),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    };
    const service = new OrdersService(prisma as unknown as PrismaService);

    await expect(
      service.updateStatus(
        orderId,
        {
          status: OrderStatus.DELIVERED,
        },
        '20000000-0000-4000-8000-000000000001',
      ),
    ).rejects.toMatchObject({
      name: 'DomainException',
      code: ErrorCode.ORDER_SHIPMENT_NOT_READY,
    });

    expect(transaction.order.update).not.toHaveBeenCalled();
  });
});
