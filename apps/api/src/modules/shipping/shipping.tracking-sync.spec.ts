import { OrderStatus, ShipmentStatus } from '../../generated/prisma/enums';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import type { ShippingProvider } from './shipping-provider.port';
import { ShippingService } from './shipping.service';

describe('ShippingService tracking sync', () => {
  it('advances shipment and order when the provider returns a normalized delivered state', async () => {
    const orderId = '10000000-0000-4000-8000-000000000001';
    const shipmentId = '20000000-0000-4000-8000-000000000001';
    const current = {
      id: shipmentId,
      orderId,
      provider: 'postex',
      providerShipmentId: 'PX-1',
      trackingCode: 'TRACK-1',
      status: ShipmentStatus.READY,
      shippedAt: null,
      deliveredAt: null,
      order: {
        id: orderId,
        status: OrderStatus.PAID,
        deliveredAt: null,
      },
    };
    const transaction = {
      shipment: {
        findUnique: jest.fn().mockResolvedValue(current),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          ...current,
          status: ShipmentStatus.DELIVERED,
        }),
      },
      shipmentStatusHistory: {
        create: jest.fn().mockResolvedValue({}),
      },
      order: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      orderStatusHistory: {
        create: jest.fn().mockResolvedValue({}),
      },
    };
    const prisma = {
      shipment: {
        findUnique: jest.fn().mockResolvedValue(current),
      },
      $transaction: jest.fn(async (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    };
    const provider: jest.Mocked<ShippingProvider> = {
      providerCode: 'postex',
      quote: jest.fn(),
      createShipment: jest.fn(),
      track: jest.fn().mockResolvedValue({
        providerStatus: 'DELIVERED',
        description: 'Delivered',
        normalizedStatus: 'DELIVERED',
      }),
    };
    const service = new ShippingService(prisma as unknown as PrismaService, provider);

    await service.syncTracking(orderId);

    expect(transaction.shipment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: shipmentId,
          status: ShipmentStatus.READY,
        },
        data: expect.objectContaining({
          status: ShipmentStatus.DELIVERED,
          lastProviderStatus: 'DELIVERED',
        }),
      }),
    );
    expect(transaction.order.updateMany).toHaveBeenCalledTimes(3);
    expect(transaction.orderStatusHistory.create).toHaveBeenCalledTimes(3);
  });
});
