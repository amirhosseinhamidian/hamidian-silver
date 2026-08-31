import type { ConfigService } from '@nestjs/config';
import { ShipmentStatus } from '../../generated/prisma/enums';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import type { ShippingService } from './shipping.service';
import { ShippingTrackingScheduler } from './shipping-tracking.scheduler';

describe('ShippingTrackingScheduler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function createScheduler(options?: {
    intervalMinutes?: string;
    batchSize?: string;
    shipments?: Array<{ id: string; orderId: string }>;
  }) {
    const prisma = {
      shipment: {
        findMany: jest.fn().mockResolvedValue(options?.shipments ?? []),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const shippingService = {
      syncTracking: jest.fn().mockResolvedValue({}),
    };
    const config = {
      get: jest.fn((key: string) => {
        if (key === 'SHIPPING_TRACKING_INTERVAL_MINUTES') {
          return options?.intervalMinutes;
        }

        if (key === 'SHIPPING_TRACKING_BATCH_SIZE') {
          return options?.batchSize;
        }

        return undefined;
      }),
    };

    return {
      scheduler: new ShippingTrackingScheduler(
        prisma as unknown as PrismaService,
        shippingService as unknown as ShippingService,
        config as unknown as ConfigService,
      ),
      prisma,
      shippingService,
    };
  }

  it('polls only active provider shipments that are due for synchronization', async () => {
    const { scheduler, prisma } = createScheduler({
      intervalMinutes: '10',
      batchSize: '25',
    });

    await scheduler.syncActiveShipments();

    expect(prisma.shipment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: {
            in: [ShipmentStatus.READY, ShipmentStatus.HANDED_OVER, ShipmentStatus.IN_TRANSIT],
          },
          providerShipmentId: {
            not: null,
          },
          AND: expect.arrayContaining([
            expect.objectContaining({
              OR: expect.arrayContaining([
                {
                  trackingAttemptedAt: null,
                },
              ]),
            }),
          ]),
        }),
        take: 25,
      }),
    );
  });

  it('continues the batch when one shipment tracking sync fails', async () => {
    const { scheduler, shippingService } = createScheduler({
      shipments: [
        {
          id: '10000000-0000-4000-8000-000000000001',
          orderId: '20000000-0000-4000-8000-000000000001',
        },
        {
          id: '10000000-0000-4000-8000-000000000002',
          orderId: '20000000-0000-4000-8000-000000000002',
        },
      ],
    });

    shippingService.syncTracking
      .mockRejectedValueOnce(new Error('Postex unavailable'))
      .mockResolvedValueOnce({});

    await scheduler.syncActiveShipments();

    expect(shippingService.syncTracking).toHaveBeenCalledTimes(2);
  });

  it('claims a shipment before provider tracking and skips work when another process won', async () => {
    const shipment = {
      id: '10000000-0000-4000-8000-000000000001',
      orderId: '20000000-0000-4000-8000-000000000001',
    };
    const { scheduler, prisma, shippingService } = createScheduler({
      shipments: [shipment],
    });

    prisma.shipment.updateMany.mockResolvedValue({ count: 0 });

    await scheduler.syncActiveShipments();

    expect(prisma.shipment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: shipment.id,
          providerShipmentId: {
            not: null,
          },
        }),
        data: {
          trackingAttemptedAt: expect.any(Date),
        },
      }),
    );
    expect(shippingService.syncTracking).not.toHaveBeenCalled();
  });

  it('does not overlap scheduler batches inside one process', async () => {
    let releaseQuery: (() => void) | undefined;
    const prisma = {
      shipment: {
        findMany: jest.fn(
          () =>
            new Promise<Array<{ id: string; orderId: string }>>((resolve) => {
              releaseQuery = () => resolve([]);
            }),
        ),
      },
    };
    const shippingService = {
      syncTracking: jest.fn(),
    };
    const config = {
      get: jest.fn(),
    };
    const scheduler = new ShippingTrackingScheduler(
      prisma as unknown as PrismaService,
      shippingService as unknown as ShippingService,
      config as unknown as ConfigService,
    );

    const firstRun = scheduler.syncActiveShipments();
    await Promise.resolve();

    await scheduler.syncActiveShipments();

    expect(prisma.shipment.findMany).toHaveBeenCalledTimes(1);

    releaseQuery?.();
    await firstRun;
  });
});
