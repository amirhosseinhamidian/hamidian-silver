import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  NotificationOutboxEventType,
  NotificationOutboxStatus,
} from '../../generated/prisma/enums';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { SMS_SENDER, type SmsSender } from '../auth/sms-sender.port';

const DEFAULT_BATCH_SIZE = 50;
const MAX_BATCH_SIZE = 200;
const DEFAULT_STALE_MINUTES = 10;
const MAX_ATTEMPTS = 8;

@Injectable()
export class NotificationOutboxWorker {
  private readonly logger = new Logger(NotificationOutboxWorker.name);
  private readonly batchSize: number;
  private readonly staleMs: number;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(SMS_SENDER) private readonly smsSender: SmsSender,
    config: ConfigService,
  ) {
    this.batchSize = Math.min(
      this.readPositiveInteger(
        config.get<unknown>('NOTIFICATION_OUTBOX_BATCH_SIZE'),
        DEFAULT_BATCH_SIZE,
      ),
      MAX_BATCH_SIZE,
    );
    this.staleMs =
      this.readPositiveInteger(
        config.get<unknown>('NOTIFICATION_OUTBOX_STALE_MINUTES'),
        DEFAULT_STALE_MINUTES,
      ) *
      60 *
      1000;
  }

  @Cron(CronExpression.EVERY_MINUTE, {
    name: 'notification-outbox-dispatch',
  })
  async dispatchPending(): Promise<void> {
    if (this.running) {
      return;
    }

    this.running = true;

    try {
      const now = new Date();
      const staleBefore = new Date(now.getTime() - this.staleMs);
      const events = await this.prisma.notificationOutboxEvent.findMany({
        where: {
          attempts: {
            lt: MAX_ATTEMPTS,
          },
          OR: [
            {
              status: {
                in: [NotificationOutboxStatus.PENDING, NotificationOutboxStatus.FAILED],
              },
              nextAttemptAt: {
                lte: now,
              },
            },
            {
              status: NotificationOutboxStatus.PROCESSING,
              claimedAt: {
                lte: staleBefore,
              },
            },
          ],
        },
        orderBy: [
          {
            nextAttemptAt: 'asc',
          },
          {
            createdAt: 'asc',
          },
        ],
        take: this.batchSize,
      });

      for (const event of events) {
        const claimedAt = new Date();
        const claimed = await this.prisma.notificationOutboxEvent.updateMany({
          where: {
            id: event.id,
            attempts: {
              lt: MAX_ATTEMPTS,
            },
            OR: [
              {
                status: {
                  in: [NotificationOutboxStatus.PENDING, NotificationOutboxStatus.FAILED],
                },
                nextAttemptAt: {
                  lte: claimedAt,
                },
              },
              {
                status: NotificationOutboxStatus.PROCESSING,
                claimedAt: {
                  lte: new Date(claimedAt.getTime() - this.staleMs),
                },
              },
            ],
          },
          data: {
            status: NotificationOutboxStatus.PROCESSING,
            claimedAt,
            attempts: {
              increment: 1,
            },
          },
        });

        if (claimed.count !== 1) {
          continue;
        }

        try {
          const message = await this.buildMessage(
            event.type,
            event.aggregateType,
            event.aggregateId,
          );

          if (!this.smsSender.sendMessage) {
            throw new Error('Configured SMS sender does not support transactional messages.');
          }

          await this.smsSender.sendMessage(message);

          await this.prisma.notificationOutboxEvent.updateMany({
            where: {
              id: event.id,
              status: NotificationOutboxStatus.PROCESSING,
            },
            data: {
              status: NotificationOutboxStatus.SENT,
              processedAt: new Date(),
              claimedAt: null,
              lastError: null,
            },
          });
        } catch (error) {
          const attempts = event.attempts + 1;
          const retryAt = new Date(Date.now() + this.retryDelayMs(attempts));

          await this.prisma.notificationOutboxEvent.updateMany({
            where: {
              id: event.id,
              status: NotificationOutboxStatus.PROCESSING,
            },
            data: {
              status: NotificationOutboxStatus.FAILED,
              nextAttemptAt: retryAt,
              claimedAt: null,
              lastError: this.errorMessage(error).slice(0, 1000),
            },
          });

          this.logger.warn(
            `Notification outbox event ${event.id} failed: ${this.errorMessage(error)}`,
          );
        }
      }
    } catch (error) {
      this.logger.error(`Notification outbox batch failed: ${this.errorMessage(error)}`);
    } finally {
      this.running = false;
    }
  }

  private async buildMessage(
    type: NotificationOutboxEventType,
    aggregateType: string,
    aggregateId: string,
  ): Promise<{ phone: string; text: string }> {
    if (aggregateType !== 'ORDER') {
      throw new Error(`Unsupported notification aggregate type: ${aggregateType}`);
    }

    const order = await this.prisma.order.findUnique({
      where: {
        id: aggregateId,
      },
      select: {
        orderNumber: true,
        user: {
          select: {
            phone: true,
          },
        },
        shipment: {
          select: {
            trackingCode: true,
          },
        },
      },
    });

    if (!order) {
      throw new Error('Notification order was not found.');
    }

    const trackingSuffix = order.shipment?.trackingCode
      ? ` کد رهگیری: ${order.shipment.trackingCode}`
      : '';

    switch (type) {
      case NotificationOutboxEventType.PAYMENT_VERIFIED:
        return {
          phone: order.user.phone,
          text: `پرداخت سفارش ${order.orderNumber} با موفقیت ثبت شد.`,
        };
      case NotificationOutboxEventType.SHIPMENT_TRACKING_AVAILABLE:
        if (!order.shipment?.trackingCode) {
          throw new Error('Shipment tracking code is not available yet.');
        }

        return {
          phone: order.user.phone,
          text: `کد رهگیری سفارش ${order.orderNumber}: ${order.shipment.trackingCode}`,
        };
      case NotificationOutboxEventType.ORDER_SHIPPED:
        return {
          phone: order.user.phone,
          text: `سفارش ${order.orderNumber} ارسال شد.${trackingSuffix}`,
        };
      case NotificationOutboxEventType.ORDER_DELIVERED:
        return {
          phone: order.user.phone,
          text: `سفارش ${order.orderNumber} تحویل شد. از خرید شما سپاسگزاریم.`,
        };
      case NotificationOutboxEventType.PAYMENT_RECONCILIATION_REQUIRED:
        return {
          phone: order.user.phone,
          text: `پرداخت سفارش ${order.orderNumber} ثبت شده و در حال بررسی است. لطفاً تا پایان بررسی پرداخت مجدد انجام ندهید.`,
        };
    }
  }

  private retryDelayMs(attempt: number): number {
    const exponent = Math.max(0, Math.min(attempt - 1, 6));
    return Math.min(60 * 60 * 1000, 60 * 1000 * 2 ** exponent);
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
