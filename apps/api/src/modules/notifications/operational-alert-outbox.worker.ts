import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificationOutboxStatus, OperationalAlertLevel } from '../../generated/prisma/enums';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { SMS_SENDER, type SmsSender } from '../auth/sms-sender.port';

const DEFAULT_BATCH_SIZE = 50;
const MAX_BATCH_SIZE = 200;
const DEFAULT_STALE_MINUTES = 10;
const MAX_ATTEMPTS = 8;

@Injectable()
export class OperationalAlertOutboxWorker {
  private readonly logger = new Logger(OperationalAlertOutboxWorker.name);
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
        config.get<unknown>('OPERATIONAL_ALERT_OUTBOX_BATCH_SIZE'),
        DEFAULT_BATCH_SIZE,
      ),
      MAX_BATCH_SIZE,
    );
    this.staleMs =
      this.readPositiveInteger(
        config.get<unknown>('OPERATIONAL_ALERT_OUTBOX_STALE_MINUTES'),
        DEFAULT_STALE_MINUTES,
      ) *
      60 *
      1000;
  }

  @Cron(CronExpression.EVERY_MINUTE, {
    name: 'operational-alert-outbox-dispatch',
  })
  async dispatchPending(): Promise<void> {
    if (this.running) {
      return;
    }

    this.running = true;

    try {
      const now = new Date();
      const staleBefore = new Date(now.getTime() - this.staleMs);
      const events = await this.prisma.operationalAlertOutboxEvent.findMany({
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
        const claimed = await this.prisma.operationalAlertOutboxEvent.updateMany({
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
          if (!this.smsSender.sendMessage) {
            throw new Error('Configured SMS sender does not support transactional messages.');
          }

          await this.smsSender.sendMessage({
            phone: event.recipientPhone,
            text: this.buildMessage(event.code, event.level, this.readOrderNumber(event.payload)),
          });

          await this.prisma.operationalAlertOutboxEvent.updateMany({
            where: {
              id: event.id,
              status: NotificationOutboxStatus.PROCESSING,
              claimedAt,
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

          await this.prisma.operationalAlertOutboxEvent.updateMany({
            where: {
              id: event.id,
              status: NotificationOutboxStatus.PROCESSING,
              claimedAt,
            },
            data: {
              status: NotificationOutboxStatus.FAILED,
              nextAttemptAt: retryAt,
              claimedAt: null,
              lastError: this.errorMessage(error).slice(0, 1000),
            },
          });

          this.logger.warn(
            `Operational alert outbox event ${event.id} failed: ${this.errorMessage(error)}`,
          );
        }
      }
    } catch (error) {
      this.logger.error(`Operational alert outbox batch failed: ${this.errorMessage(error)}`);
    } finally {
      this.running = false;
    }
  }

  private buildMessage(code: string, level: OperationalAlertLevel, orderNumber: string) {
    const prefix =
      level === OperationalAlertLevel.ESCALATION ? 'فوری - پیگیری مجدد' : 'هشدار عملیات';

    switch (code) {
      case 'PLATING_OVERDUE':
        return `${prefix}: آبکاری سفارش ${orderNumber} از زمان‌بندی تعیین‌شده عبور کرده است.`;
      case 'PLATING_CANCELLED':
        return `${prefix}: آبکاری سفارش ${orderNumber} لغو شده و نیاز به بررسی عملیاتی دارد.`;
      case 'SHIPMENT_CREATION_STALE':
        return `${prefix}: ایجاد مرسوله سفارش ${orderNumber} بیش از حد مجاز در حال پردازش مانده است.`;
      case 'SHIPMENT_PROVIDER_RECONCILIATION_REQUIRED':
        return `${prefix}: وضعیت ایجاد مرسوله سفارش ${orderNumber} نیاز به تطبیق با سرویس ارسال دارد.`;
      default:
        return `${prefix}: سفارش ${orderNumber} نیاز به بررسی دارد.`;
    }
  }

  private readOrderNumber(payload: unknown): string {
    if (
      typeof payload === 'object' &&
      payload !== null &&
      'orderNumber' in payload &&
      typeof payload.orderNumber === 'string'
    ) {
      return payload.orderNumber;
    }

    return 'نامشخص';
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
