import { ConflictException } from '@nestjs/common';
import { OrderStatus, ShipmentStatus } from '../../generated/prisma/enums';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import type { ShippingProvider } from './shipping-provider.port';
import { ShippingService } from './shipping.service';

describe('ShippingService tracking sync', () => {
  const orderId = '10000000-0000-4000-8000-000000000001';
  const shipmentId = '20000000-0000-4000-8000-000000000001';

  function baseCurrent(status: ShipmentStatus = ShipmentStatus.READY) {
    return {
      id: shipmentId,
      orderId,
      provider: 'postex',
      providerShipmentId: 'PX-1',
      trackingCode: 'TRACK-1',
      status,
      lastProviderStatus: status,
      lastProviderDescription: 'Current provider state',
      lastTrackingSyncAt: new Date('2026-08-31T10:00:00.000Z'),
      trackingAttemptedAt: new Date('2026-08-31T10:00:00.000Z'),
      trackingSyncToken: null,
      trackingSyncStartedAt: null,
      shippedAt: status === ShipmentStatus.READY ? null : new Date('2026-08-31T09:00:00.000Z'),
      deliveredAt: null,
      order: {
        id: orderId,
        status: status === ShipmentStatus.READY ? OrderStatus.PAID : OrderStatus.SHIPPED,
        deliveredAt: null,
      },
    };
  }

  function provider(result: {
    providerStatus: string;
    description?: string;
    normalizedStatus?: 'HANDED_OVER' | 'IN_TRANSIT' | 'DELIVERED' | 'FAILED';
  }): jest.Mocked<ShippingProvider> {
    return {
      providerCode: 'postex',
      quote: jest.fn(),
      createShipment: jest.fn(),
      track: jest.fn().mockResolvedValue(result),
    };
  }

  it('advances shipment and order when the provider returns a normalized delivered state', async () => {
    const current = baseCurrent();
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
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      $transaction: jest.fn(async (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    };
    const shippingProvider = provider({
      providerStatus: 'DELIVERED',
      description: 'Delivered',
      normalizedStatus: 'DELIVERED',
    });
    const service = new ShippingService(prisma as unknown as PrismaService, shippingProvider);

    await service.syncTracking(orderId);

    expect(prisma.shipment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: shipmentId,
          providerShipmentId: 'PX-1',
        }),
        data: expect.objectContaining({
          trackingSyncToken: expect.any(String),
          trackingSyncStartedAt: expect.any(Date),
          trackingAttemptedAt: expect.any(Date),
        }),
      }),
    );
    expect(transaction.shipment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: shipmentId,
          status: ShipmentStatus.READY,
          providerShipmentId: 'PX-1',
          trackingSyncToken: expect.any(String),
        }),
        data: expect.objectContaining({
          status: ShipmentStatus.DELIVERED,
          lastProviderStatus: 'DELIVERED',
          trackingSyncToken: null,
          trackingSyncStartedAt: null,
          shippedAt: expect.any(Date),
          deliveredAt: expect.any(Date),
        }),
      }),
    );
    expect(transaction.order.updateMany).toHaveBeenCalledTimes(3);
    expect(transaction.orderStatusHistory.create).toHaveBeenCalledTimes(3);
  });

  it('rejects an overlapping tracking sync before contacting the provider', async () => {
    const current = baseCurrent();
    const prisma = {
      shipment: {
        findUnique: jest.fn().mockResolvedValue(current),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      $transaction: jest.fn(),
    };
    const shippingProvider = provider({
      providerStatus: 'IN_TRANSIT',
      normalizedStatus: 'IN_TRANSIT',
    });
    const service = new ShippingService(prisma as unknown as PrismaService, shippingProvider);

    await expect(service.syncTracking(orderId)).rejects.toBeInstanceOf(ConflictException);

    expect(shippingProvider.track).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('does not finalize a stale provider response after tracking ownership changes', async () => {
    const current = baseCurrent();
    const transaction = {
      shipment: {
        findUnique: jest.fn().mockResolvedValue(current),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findUniqueOrThrow: jest.fn(),
      },
      shipmentStatusHistory: {
        create: jest.fn(),
      },
      order: {
        updateMany: jest.fn(),
      },
      orderStatusHistory: {
        create: jest.fn(),
      },
    };
    const prisma = {
      shipment: {
        findUnique: jest.fn().mockResolvedValue(current),
        updateMany: jest
          .fn()
          .mockResolvedValueOnce({ count: 1 })
          .mockResolvedValueOnce({ count: 0 }),
      },
      $transaction: jest.fn(async (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    };
    const shippingProvider = provider({
      providerStatus: 'IN_TRANSIT',
      description: 'Moving',
      normalizedStatus: 'IN_TRANSIT',
    });
    const service = new ShippingService(prisma as unknown as PrismaService, shippingProvider);

    await expect(service.syncTracking(orderId)).rejects.toThrow(
      'Shipment tracking response is stale or ownership changed; retry is required.',
    );

    expect(transaction.shipment.findUniqueOrThrow).not.toHaveBeenCalled();
    expect(transaction.shipmentStatusHistory.create).not.toHaveBeenCalled();
    expect(transaction.order.updateMany).not.toHaveBeenCalled();
    expect(prisma.shipment.updateMany).toHaveBeenCalledTimes(2);
    expect(prisma.shipment.updateMany).toHaveBeenLastCalledWith({
      where: {
        id: shipmentId,
        trackingSyncToken: expect.any(String),
      },
      data: {
        trackingSyncToken: null,
        trackingSyncStartedAt: null,
      },
    });
  });

  it('does not overwrite newer provider metadata with an out-of-order status', async () => {
    const current = baseCurrent(ShipmentStatus.IN_TRANSIT);
    const transaction = {
      shipment: {
        findUnique: jest.fn().mockResolvedValue(current),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue(current),
      },
      shipmentStatusHistory: {
        create: jest.fn(),
      },
      order: {
        updateMany: jest.fn(),
      },
      orderStatusHistory: {
        create: jest.fn(),
      },
    };
    const prisma = {
      shipment: {
        findUnique: jest.fn().mockResolvedValue(current),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      $transaction: jest.fn(async (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    };
    const shippingProvider = provider({
      providerStatus: 'HANDED_OVER',
      description: 'Older provider event',
      normalizedStatus: 'HANDED_OVER',
    });
    const service = new ShippingService(prisma as unknown as PrismaService, shippingProvider);

    await service.syncTracking(orderId);

    expect(transaction.shipment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: ShipmentStatus.IN_TRANSIT,
          lastProviderStatus: ShipmentStatus.IN_TRANSIT,
          lastProviderDescription: 'Current provider state',
          lastTrackingSyncAt: expect.any(Date),
          trackingSyncToken: null,
          trackingSyncStartedAt: null,
        }),
      }),
    );
    expect(transaction.shipmentStatusHistory.create).not.toHaveBeenCalled();
    expect(transaction.order.updateMany).not.toHaveBeenCalled();
  });
});
