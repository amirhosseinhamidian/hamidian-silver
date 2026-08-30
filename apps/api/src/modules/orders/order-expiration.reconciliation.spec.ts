import { OrderStatus, PaymentStatus } from '../../generated/prisma/enums';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import { OrderExpirationService } from './order-expiration.service';

describe('OrderExpirationService reconciliation safety', () => {
  it('does not expire an order while a captured payment needs reconciliation', async () => {
    const orderId = '10000000-0000-4000-8000-000000000001';
    const transaction = {
      order: {
        findUnique: jest.fn().mockResolvedValue({
          id: orderId,
          warehouseId: '20000000-0000-4000-8000-000000000001',
          status: OrderStatus.PENDING_PAYMENT,
          reservationExpiresAt: new Date('2026-08-30T10:00:00.000Z'),
          payment: {
            status: PaymentStatus.RECONCILIATION_REQUIRED,
          },
          items: [],
        }),
        updateMany: jest.fn(),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    };
    const service = new OrderExpirationService(prisma as unknown as PrismaService);

    await expect(service.expireOrder(orderId, new Date('2026-08-30T11:00:00.000Z'))).resolves.toBe(
      false,
    );

    expect(transaction.order.updateMany).not.toHaveBeenCalled();
  });
});
