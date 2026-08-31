import { ConflictException } from '@nestjs/common';
import {
  OrderStatus,
  ShipmentProviderCreationState,
  ShipmentStatus,
} from '../../generated/prisma/enums';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import type { ShippingProvider } from './shipping-provider.port';
import { ShippingService } from './shipping.service';

describe('ShippingService status concurrency', () => {
  it('does not write shipment history when another worker wins the transition', async () => {
    const orderId = '10000000-0000-4000-8000-000000000001';
    const shipmentId = '20000000-0000-4000-8000-000000000001';
    const actorUserId = '30000000-0000-4000-8000-000000000001';
    const transaction = {
      shipment: {
        findUnique: jest.fn().mockResolvedValue({
          id: shipmentId,
          orderId,
          status: ShipmentStatus.PENDING,
          trackingCode: null,
          providerShipmentId: null,
          providerCreationState: ShipmentProviderCreationState.NOT_STARTED,
          providerCreateError: null,
          shippedAt: null,
          deliveredAt: null,
          order: {
            id: orderId,
            orderNumber: 'HS-TEST',
            status: OrderStatus.PAID,
            paidAt: new Date('2026-08-31T08:00:00.000Z'),
            platingTotalToman: 0,
            platingFulfillment: null,
            deliveredAt: null,
          },
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findUniqueOrThrow: jest.fn(),
      },
      shipmentStatusHistory: {
        create: jest.fn(),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    };
    const provider = {
      providerCode: 'postex',
    };
    const service = new ShippingService(
      prisma as unknown as PrismaService,
      provider as unknown as ShippingProvider,
    );

    await expect(
      service.updateStatus(
        orderId,
        {
          status: ShipmentStatus.READY,
        },
        actorUserId,
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(transaction.shipment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: shipmentId,
          status: ShipmentStatus.PENDING,
        },
      }),
    );
    expect(transaction.shipment.findUniqueOrThrow).not.toHaveBeenCalled();
    expect(transaction.shipmentStatusHistory.create).not.toHaveBeenCalled();
  });
});
