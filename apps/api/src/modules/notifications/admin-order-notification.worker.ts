import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';

import { NotificationOutboxStatus, PaymentStatus } from '../../generated/prisma/enums';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { formatAdminOrderMessage } from './admin-order-message.formatter';
import { AdminMessageSender } from './admin-message.sender';

const MAX_ATTEMPTS = 8;
const DEFAULT_BATCH_SIZE = 50;
const DEFAULT_STALE_MINUTES = 10;

@Injectable()
export class AdminOrderNotificationWorker {
  private readonly logger = new Logger(AdminOrderNotificationWorker.name);
  private readonly adminOrigin: string;
  private readonly batchSize: number;
  private readonly staleMs: number;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly sender: AdminMessageSender,
    config: ConfigService,
  ) {
    this.adminOrigin = config.get<string>('ADMIN_APP_ORIGIN', 'http://localhost:3002');
    this.batchSize = config.get<number>('ADMIN_MESSAGING_OUTBOX_BATCH_SIZE', DEFAULT_BATCH_SIZE);
    this.staleMs =
      config.get<number>('ADMIN_MESSAGING_OUTBOX_STALE_MINUTES', DEFAULT_STALE_MINUTES) * 60_000;
  }

  @Cron(CronExpression.EVERY_MINUTE, { name: 'admin-order-notification-dispatch' })
  async dispatchPending(): Promise<void> {
    if (this.running) return;
    this.running = true;

    try {
      const now = new Date();
      const staleBefore = new Date(now.getTime() - this.staleMs);
      const deliveries = await this.prisma.adminOrderNotificationDelivery.findMany({
        where: {
          OR: [
            { status: NotificationOutboxStatus.PENDING, nextAttemptAt: { lte: now } },
            {
              status: NotificationOutboxStatus.FAILED,
              attempts: { lt: MAX_ATTEMPTS },
              nextAttemptAt: { lte: now },
            },
            {
              status: NotificationOutboxStatus.PROCESSING,
              claimedAt: { lte: staleBefore },
            },
          ],
        },
        orderBy: [{ nextAttemptAt: 'asc' }, { createdAt: 'asc' }],
        take: Math.min(this.batchSize, 200),
      });

      for (const delivery of deliveries) {
        if (
          delivery.status === NotificationOutboxStatus.PROCESSING &&
          delivery.attempts >= MAX_ATTEMPTS
        ) {
          await this.prisma.adminOrderNotificationDelivery.updateMany({
            where: {
              id: delivery.id,
              status: NotificationOutboxStatus.PROCESSING,
              claimedAt: delivery.claimedAt,
            },
            data: {
              status: NotificationOutboxStatus.FAILED,
              claimedAt: null,
              lastError: 'Worker lease expired after the maximum delivery attempts.',
            },
          });
          continue;
        }
        await this.dispatch(
          delivery.id,
          delivery.orderId,
          delivery.channel,
          delivery.chatIdSnapshot,
        );
      }
    } catch (error) {
      this.logger.error(`Admin order notification batch failed: ${this.errorMessage(error)}`);
    } finally {
      this.running = false;
    }
  }

  private async dispatch(
    deliveryId: string,
    orderId: string,
    channel: Parameters<AdminMessageSender['send']>[0],
    chatId: string,
  ): Promise<void> {
    const claimedAt = new Date();
    const staleBefore = new Date(claimedAt.getTime() - this.staleMs);
    const claimed = await this.prisma.adminOrderNotificationDelivery.updateMany({
      where: {
        id: deliveryId,
        OR: [
          { status: NotificationOutboxStatus.PENDING, nextAttemptAt: { lte: claimedAt } },
          {
            status: NotificationOutboxStatus.FAILED,
            attempts: { lt: MAX_ATTEMPTS },
            nextAttemptAt: { lte: claimedAt },
          },
          {
            status: NotificationOutboxStatus.PROCESSING,
            attempts: { lt: MAX_ATTEMPTS },
            claimedAt: { lte: staleBefore },
          },
        ],
      },
      data: {
        status: NotificationOutboxStatus.PROCESSING,
        attempts: { increment: 1 },
        claimedAt,
      },
    });
    if (claimed.count !== 1) return;

    try {
      const order = await this.prisma.order.findUniqueOrThrow({
        where: { id: orderId },
        select: {
          id: true,
          orderNumber: true,
          createdAt: true,
          merchandiseTotalToman: true,
          platingTotalToman: true,
          discountTotalToman: true,
          shippingTotalToman: true,
          taxTotalToman: true,
          grandTotalToman: true,
          payment: { select: { status: true } },
          customerNote: true,
          shippingCarrierNameSnapshot: true,
          user: { select: { phone: true, firstName: true, lastName: true } },
          shippingAddress: true,
          items: {
            orderBy: { createdAt: 'asc' },
            select: {
              productNameSnapshot: true,
              variantNameSnapshot: true,
              skuSnapshot: true,
              sizeLabelSnapshot: true,
              platingType: true,
              quantity: true,
              lineTotalToman: true,
            },
          },
        },
      });
      if (
        order.payment?.status !== PaymentStatus.PAID &&
        order.payment?.status !== PaymentStatus.AWAITING_REVIEW
      ) {
        throw new Error(
          `Admin order notification is not ready at ${order.payment?.status ?? 'NO_PAYMENT'}.`,
        );
      }
      await this.sender.send(channel, chatId, formatAdminOrderMessage(order, this.adminOrigin));
      await this.prisma.adminOrderNotificationDelivery.updateMany({
        where: { id: deliveryId, status: NotificationOutboxStatus.PROCESSING, claimedAt },
        data: {
          status: NotificationOutboxStatus.SENT,
          processedAt: new Date(),
          claimedAt: null,
          lastError: null,
        },
      });
    } catch (error) {
      const attempts = await this.prisma.adminOrderNotificationDelivery.findUnique({
        where: { id: deliveryId },
        select: { attempts: true },
      });
      const attemptCount = attempts?.attempts ?? MAX_ATTEMPTS;
      await this.prisma.adminOrderNotificationDelivery.updateMany({
        where: { id: deliveryId, status: NotificationOutboxStatus.PROCESSING, claimedAt },
        data: {
          status: NotificationOutboxStatus.FAILED,
          nextAttemptAt: new Date(Date.now() + this.retryDelayMs(attemptCount)),
          claimedAt: null,
          lastError: this.errorMessage(error).slice(0, 1000),
        },
      });
      this.logger.warn(
        `Admin order notification ${deliveryId} failed: ${this.errorMessage(error)}`,
      );
    }
  }

  private retryDelayMs(attempts: number): number {
    return Math.min(2 ** Math.max(0, attempts - 1) * 60_000, 6 * 60 * 60_000);
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
