import {
  OrderStatus,
  PaymentStatus,
  ShipmentProviderCreationState,
  ShipmentStatus,
} from '../../generated/prisma/enums';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import { OperationsWorkQueueService } from './operations-work-queue.service';

describe('OperationsWorkQueueService', () => {
  it('filters derived queue items after evaluating all active operational orders', async () => {
    const prisma = {
      order: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: '10000000-0000-4000-8000-000000000001',
            orderNumber: 'HS-050-READY',
            status: OrderStatus.PAID,
            paidAt: new Date('2026-08-30T10:00:00.000Z'),
            payment: {
              status: PaymentStatus.PAID,
            },
            platingTotalToman: 0,
            items: [],
            platingFulfillment: null,
            shipment: {
              id: '20000000-0000-4000-8000-000000000001',
              status: ShipmentStatus.PENDING,
              provider: 'postex',
              providerCreationState: ShipmentProviderCreationState.NOT_STARTED,
              providerShipmentId: null,
              providerCreateError: null,
              creationAttemptedAt: null,
            },
          },
        ]),
      },
    };
    const service = new OperationsWorkQueueService(prisma as unknown as PrismaService);

    const result = await service.list({
      type: 'SHIPPING',
      state: 'READY',
      limit: 25,
    });

    expect(result.count).toBe(1);
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        code: 'READY_FOR_SHIPMENT_CREATION',
        workType: 'SHIPPING',
        state: 'READY',
      }),
    );
    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: {
            in: [OrderStatus.PAID, OrderStatus.PROCESSING],
          },
          payment: {
            is: {
              status: PaymentStatus.PAID,
            },
          },
        },
      }),
    );
  });
});
