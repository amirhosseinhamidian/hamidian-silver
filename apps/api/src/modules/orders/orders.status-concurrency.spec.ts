import { ConflictException } from '@nestjs/common';
import { OrderStatus } from '../../generated/prisma/enums';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import { OrdersService } from './orders.service';

describe('OrdersService status concurrency', () => {
  it('does not write history when another worker wins the status transition', async () => {
    const orderId = '10000000-0000-4000-8000-000000000001';
    const actorUserId = '20000000-0000-4000-8000-000000000001';
    const transaction = {
      order: {
        findUnique: jest.fn().mockResolvedValue({
          id: orderId,
          status: OrderStatus.PAID,
          deliveredAt: null,
          shipment: null,
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findUniqueOrThrow: jest.fn(),
      },
      orderStatusHistory: {
        create: jest.fn(),
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
          status: OrderStatus.PROCESSING,
        },
        actorUserId,
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(transaction.order.updateMany).toHaveBeenCalledWith({
      where: {
        id: orderId,
        status: OrderStatus.PAID,
      },
      data: {
        status: OrderStatus.PROCESSING,
        deliveredAt: null,
      },
    });
    expect(transaction.order.findUniqueOrThrow).not.toHaveBeenCalled();
    expect(transaction.orderStatusHistory.create).not.toHaveBeenCalled();
  });
});
