import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificationOutboxStatus, OperationalAlertLevel } from '../../generated/prisma/enums';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { isSmsDeliveryUnknownError } from '../auth/sms-delivery-unknown.error';
import { SMS_SENDER, type SmsSender } from '../auth/sms-sender.port';

const DEFAULT_BATCH_SIZE = 50;
const MAX_BATCH_SIZE = 200;
const DEFAULT_STALE_MINUTES = 10;
const MAX_ATTEMPTS = 8;
const STALE_DISPATCH_ERROR =
  'SMS dispatch outcome is unknown because the worker lease expired before confirmation.';

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
          OR: [
            {
              status: NotificationOutboxStatus.PENDING,
              nextAttemptAt: {
                lte: now,
              },
            },
            {
              status: NotificationOutboxStatus.FAILED,
              attempts: {
                lt: MAX_ATTEMPTS,
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
            {
              status: NotificationOutboxStatus.DISPATCHING,
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
        if (event.status === NotificationOutboxStatus.DISPATCHING) {
          await this.quarantineStaleDispatch(event.id, event.claimedAt, staleBefore);
          continue;
        }

        if (
          event.status === NotificationOutboxStatus.PROCESSING &&
          event.attempts >= MAX_ATTEMPTS
        ) {
          await this.releaseExhaustedProcessing(event.id, event.claimedAt, staleBefore);
          continue;
        }

        const claimedAt = new Date();
        const claimed = await this.prisma.operationalAlertOutboxEvent.updateMany({
          where: {
            id: event.id,
            OR: [
              {
                status: NotificationOutboxStatus.PENDING,
                nextAttemptAt: {
                  lte: claimedAt,
                },
              },
              {
                status: NotificationOutboxStatus.FAILED,
                attempts: {
                  lt: MAX_ATTEMPTS,
                },
                nextAttemptAt: {
                  lte: claimedAt,
                },
              },
              {
                status: NotificationOutboxStatus.PROCESSING,
                attempts: {
                  lt: MAX_ATTEMPTS,
                },
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

        if (!this.smsSender.sendMessage) {
          await this.failBeforeDispatch(
            event.id,
            claimedAt,
            event.attempts + 1,
            new Error('Configured SMS sender does not support transactional messages.'),
          );
          continue;
        }

        const sendMessage = this.smsSender.sendMessage.bind(this.smsSender);
        const message = {
          phone: event.recipientPhone,
          text: this.buildMessage(event.code, event.level, this.readOrderNumber(event.payload)),
        };

        const dispatching = await this.prisma.operationalAlertOutboxEvent.updateMany({
          where: {
            id: event.id,
            status: NotificationOutboxStatus.PROCESSING,
            claimedAt,
          },
          data: {
            status: NotificationOutboxStatus.DISPATCHING,
          },
        });

        if (dispatching.count !== 1) {
          continue;
        }

        try {
          await sendMessage(message);

          await this.prisma.operationalAlertOutboxEvent.updateMany({
            where: {
              id: event.id,
              status: NotificationOutboxStatus.DISPATCHING,
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
          await this.settleDispatchFailure(event.id, claimedAt, event.attempts + 1, error);
        }
      }
    } catch (error) {
      this.logger.error(`Operational alert outbox batch failed: ${this.errorMessage(error)}`);
    } finally {
      this.running = false;
    }
  }

  private async releaseExhaustedProcessing(
    eventId: string,
    claimedAt: Date | null,
    staleBefore: Date,
  ): Promise<void> {
    if (!claimedAt || claimedAt > staleBefore) {
      return;
    }

    await this.prisma.operationalAlertOutboxEvent.updateMany({
      where: {
        id: eventId,
        status: NotificationOutboxStatus.PROCESSING,
        claimedAt,
        attempts: {
          gte: MAX_ATTEMPTS,
        },
      },
      data: {
        status: NotificationOutboxStatus.FAILED,
        claimedAt: null,
        lastError:
          'Operational alert processing lease expired after the maximum attempts before SMS dispatch.',
      },
    });
  }

  private async quarantineStaleDispatch(
    eventId: string,
    claimedAt: Date | null,
    staleBefore: Date,
  ): Promise<void> {
    if (!claimedAt || claimedAt > staleBefore) {
      return;
    }

    await this.prisma.operationalAlertOutboxEvent.updateMany({
      where: {
        id: eventId,
        status: NotificationOutboxStatus.DISPATCHING,
        claimedAt,
      },
      data: {
        status: NotificationOutboxStatus.UNKNOWN,
        claimedAt: null,
        lastError: STALE_DISPATCH_ERROR,
      },
    });
  }

  private async failBeforeDispatch(
    eventId: string,
    claimedAt: Date,
    attempts: number,
    error: unknown,
  ): Promise<void> {
    const retryAt = new Date(Date.now() + this.retryDelayMs(attempts));

    await this.prisma.operationalAlertOutboxEvent.updateMany({
      where: {
        id: eventId,
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
      `Operational alert outbox event ${eventId} failed: ${this.errorMessage(error)}`,
    );
  }

  private async settleDispatchFailure(
    eventId: string,
    claimedAt: Date,
    attempts: number,
    error: unknown,
  ): Promise<void> {
    if (isSmsDeliveryUnknownError(error)) {
      await this.prisma.operationalAlertOutboxEvent.updateMany({
        where: {
          id: eventId,
          status: NotificationOutboxStatus.DISPATCHING,
          claimedAt,
        },
        data: {
          status: NotificationOutboxStatus.UNKNOWN,
          claimedAt: null,
          lastError: this.errorMessage(error).slice(0, 1000),
        },
      });

      this.logger.warn(
        `Operational alert outbox event ${eventId} has an unknown delivery outcome: ${this.errorMessage(error)}`,
      );
      return;
    }

    const retryAt = new Date(Date.now() + this.retryDelayMs(attempts));

    await this.prisma.operationalAlertOutboxEvent.updateMany({
      where: {
        id: eventId,
        status: NotificationOutboxStatus.DISPATCHING,
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
      `Operational alert outbox event ${eventId} failed: ${this.errorMessage(error)}`,
    );
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
      case 'PAYMENT_INITIATION_STUCK':
        return `${prefix}: آغاز پرداخت سفارش ${orderNumber} در وضعیت نامشخص مانده و نیاز به بررسی درگاه دارد.`;
      case 'PAYMENT_RECONCILIATION_OPEN':
        return `${prefix}: تطبیق مالی پرداخت سفارش ${orderNumber} باز مانده و نیاز به پیگیری دارد.`;
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
