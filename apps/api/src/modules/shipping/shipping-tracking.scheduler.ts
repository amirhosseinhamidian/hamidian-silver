import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ShipmentStatus } from '../../generated/prisma/enums';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { TRACKING_SYNC_LEASE_MS } from './shipping-tracking.constants';
import { ShippingService } from './shipping.service';

const DEFAULT_TRACKING_INTERVAL_MINUTES = 10;
const DEFAULT_TRACKING_BATCH_SIZE = 50;
const MAX_TRACKING_BATCH_SIZE = 200;

@Injectable()
export class ShippingTrackingScheduler {
  private readonly logger = new Logger(ShippingTrackingScheduler.name);
  private readonly trackingIntervalMs: number;
  private readonly batchSize: number;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly shippingService: ShippingService,
    config: ConfigService,
  ) {
    const intervalMinutes = this.readPositiveInteger(
      config.get<unknown>('SHIPPING_TRACKING_INTERVAL_MINUTES'),
      DEFAULT_TRACKING_INTERVAL_MINUTES,
    );
    const requestedBatchSize = this.readPositiveInteger(
      config.get<unknown>('SHIPPING_TRACKING_BATCH_SIZE'),
      DEFAULT_TRACKING_BATCH_SIZE,
    );

    this.trackingIntervalMs = intervalMinutes * 60 * 1000;
    this.batchSize = Math.min(requestedBatchSize, MAX_TRACKING_BATCH_SIZE);
  }

  @Cron(CronExpression.EVERY_MINUTE, {
    name: 'shipping-tracking-sync',
  })
  async syncActiveShipments(): Promise<void> {
    if (this.running) {
      return;
    }

    this.running = true;

    try {
      const dueBefore = new Date(Date.now() - this.trackingIntervalMs);
      const staleLeaseBefore = new Date(Date.now() - TRACKING_SYNC_LEASE_MS);
      const activeStatuses = [
        ShipmentStatus.READY,
        ShipmentStatus.HANDED_OVER,
        ShipmentStatus.IN_TRANSIT,
      ];
      const dueFilter = {
        AND: [
          {
            OR: [
              {
                lastTrackingSyncAt: null,
              },
              {
                lastTrackingSyncAt: {
                  lte: dueBefore,
                },
              },
            ],
          },
          {
            OR: [
              {
                trackingAttemptedAt: null,
              },
              {
                trackingAttemptedAt: {
                  lte: dueBefore,
                },
              },
            ],
          },
          {
            OR: [
              {
                trackingSyncToken: null,
              },
              {
                trackingSyncStartedAt: {
                  lte: staleLeaseBefore,
                },
              },
            ],
          },
        ],
      };

      const shipments = await this.prisma.shipment.findMany({
        where: {
          status: {
            in: activeStatuses,
          },
          providerShipmentId: {
            not: null,
          },
          ...dueFilter,
        },
        orderBy: [
          {
            lastTrackingSyncAt: 'asc',
          },
          {
            createdAt: 'asc',
          },
        ],
        take: this.batchSize,
        select: {
          id: true,
          orderId: true,
        },
      });

      for (const shipment of shipments) {
        try {
          await this.shippingService.syncTracking(shipment.orderId);
        } catch (error) {
          this.logger.warn(
            `Shipping tracking sync failed for shipment ${shipment.id}: ${this.errorMessage(error)}`,
          );
        }
      }
    } catch (error) {
      this.logger.error(`Shipping tracking scheduler batch failed: ${this.errorMessage(error)}`);
    } finally {
      this.running = false;
    }
  }

  private readPositiveInteger(value: unknown, fallback: number): number {
    const parsed =
      typeof value === 'number'
        ? value
        : typeof value === 'string' && /^\d+$/.test(value)
          ? Number(value)
          : Number.NaN;

    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Unknown error';
  }
}
