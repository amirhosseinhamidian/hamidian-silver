import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  NotificationOutboxRecoveryResolution,
  NotificationOutboxStatus,
} from '../../generated/prisma/enums';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import type { ResolveNotificationOutboxRecoveryDto } from './dto/resolve-notification-outbox-recovery.dto';
import type { ListNotificationOutboxQueryDto } from './dto/list-notification-outbox-query.dto';
import type { RetryNotificationOutboxDto } from './dto/retry-notification-outbox.dto';

@Injectable()
export class NotificationOutboxRecoveryService {
  constructor(private readonly prisma: PrismaService) {}

  async listUnknown() {
    const [customer, operational] = await Promise.all([
      this.prisma.notificationOutboxEvent.findMany({
        where: {
          status: NotificationOutboxStatus.UNKNOWN,
        },
        take: 100,
        orderBy: {
          updatedAt: 'asc',
        },
        select: {
          id: true,
          type: true,
          aggregateType: true,
          aggregateId: true,
          deduplicationKey: true,
          attempts: true,
          lastError: true,
          createdAt: true,
          updatedAt: true,
          recoveries: {
            take: 5,
            orderBy: {
              createdAt: 'desc',
            },
          },
        },
      }),
      this.prisma.operationalAlertOutboxEvent.findMany({
        where: {
          status: NotificationOutboxStatus.UNKNOWN,
        },
        take: 100,
        orderBy: {
          updatedAt: 'asc',
        },
        select: {
          id: true,
          orderId: true,
          recipientUserId: true,
          recipientPhone: true,
          code: true,
          level: true,
          priority: true,
          incidentFingerprint: true,
          attempts: true,
          lastError: true,
          createdAt: true,
          updatedAt: true,
          recoveries: {
            take: 5,
            orderBy: {
              createdAt: 'desc',
            },
          },
        },
      }),
    ]);

    return {
      customer,
      operational,
      total: customer.length + operational.length,
    };
  }

  async resolveCustomer(
    eventId: string,
    actorUserId: string,
    dto: ResolveNotificationOutboxRecoveryDto,
    now = new Date(),
  ) {
    return this.prisma.$transaction(async (transaction) => {
      const event = await transaction.notificationOutboxEvent.findUnique({
        where: {
          id: eventId,
        },
      });

      if (!event) {
        throw new NotFoundException('Notification outbox event was not found.');
      }

      if (event.status !== NotificationOutboxStatus.UNKNOWN) {
        throw new ConflictException('Only unknown notification deliveries can be resolved.');
      }

      const resolved = await transaction.notificationOutboxEvent.updateMany({
        where: {
          id: event.id,
          status: NotificationOutboxStatus.UNKNOWN,
        },
        data: this.resolutionData(dto.resolution, now),
      });

      if (resolved.count !== 1) {
        throw new ConflictException(
          'Notification recovery state changed; reload before resolving again.',
        );
      }

      await transaction.notificationOutboxRecovery.create({
        data: {
          eventId: event.id,
          resolution: dto.resolution,
          note: dto.note,
          unknownReasonSnapshot: event.lastError,
          resolvedByUserId: actorUserId,
        },
      });

      return transaction.notificationOutboxEvent.findUniqueOrThrow({
        where: {
          id: event.id,
        },
        include: {
          recoveries: {
            orderBy: {
              createdAt: 'desc',
            },
          },
        },
      });
    });
  }

  async resolveOperational(
    eventId: string,
    actorUserId: string,
    dto: ResolveNotificationOutboxRecoveryDto,
    now = new Date(),
  ) {
    return this.prisma.$transaction(async (transaction) => {
      const event = await transaction.operationalAlertOutboxEvent.findUnique({
        where: {
          id: eventId,
        },
      });

      if (!event) {
        throw new NotFoundException('Operational alert outbox event was not found.');
      }

      if (event.status !== NotificationOutboxStatus.UNKNOWN) {
        throw new ConflictException('Only unknown operational alert deliveries can be resolved.');
      }

      const resolved = await transaction.operationalAlertOutboxEvent.updateMany({
        where: {
          id: event.id,
          status: NotificationOutboxStatus.UNKNOWN,
        },
        data: this.resolutionData(dto.resolution, now),
      });

      if (resolved.count !== 1) {
        throw new ConflictException(
          'Operational alert recovery state changed; reload before resolving again.',
        );
      }

      await transaction.operationalAlertOutboxRecovery.create({
        data: {
          eventId: event.id,
          resolution: dto.resolution,
          note: dto.note,
          unknownReasonSnapshot: event.lastError,
          resolvedByUserId: actorUserId,
        },
      });

      return transaction.operationalAlertOutboxEvent.findUniqueOrThrow({
        where: {
          id: event.id,
        },
        include: {
          recoveries: {
            orderBy: {
              createdAt: 'desc',
            },
          },
        },
      });
    });
  }

  async retryFailedCustomer(
    eventId: string,
    actorUserId: string,
    dto: RetryNotificationOutboxDto,
    now = new Date(),
  ) {
    await this.retryFailed('CUSTOMER', eventId, actorUserId, dto.note, now);
    return this.listOutbox();
  }

  async retryFailedOperational(
    eventId: string,
    actorUserId: string,
    dto: RetryNotificationOutboxDto,
    now = new Date(),
  ) {
    await this.retryFailed('OPERATIONAL', eventId, actorUserId, dto.note, now);
    return this.listOutbox();
  }

  private async retryFailed(
    source: 'CUSTOMER' | 'OPERATIONAL',
    eventId: string,
    actorUserId: string,
    note: string,
    now: Date,
  ) {
    return this.prisma.$transaction(async (transaction) => {
      if (source === 'CUSTOMER') {
        const event = await transaction.notificationOutboxEvent.findUnique({
          where: { id: eventId },
        });
        if (!event) throw new NotFoundException('Notification outbox event was not found.');
        if (event.status !== NotificationOutboxStatus.FAILED) {
          throw new ConflictException('Only failed notification deliveries can be retried.');
        }
        const updated = await transaction.notificationOutboxEvent.updateMany({
          where: { id: eventId, status: NotificationOutboxStatus.FAILED },
          data: {
            status: NotificationOutboxStatus.PENDING,
            nextAttemptAt: now,
            claimedAt: null,
            processedAt: null,
            lastError: null,
          },
        });
        if (updated.count !== 1)
          throw new ConflictException('Notification state changed; reload before retrying.');
        await transaction.notificationOutboxRecovery.create({
          data: {
            eventId,
            resolution: NotificationOutboxRecoveryResolution.RETRY_APPROVED,
            note,
            unknownReasonSnapshot: event.lastError,
            resolvedByUserId: actorUserId,
          },
        });
        return;
      }
      const event = await transaction.operationalAlertOutboxEvent.findUnique({
        where: { id: eventId },
      });
      if (!event) throw new NotFoundException('Operational alert outbox event was not found.');
      if (event.status !== NotificationOutboxStatus.FAILED) {
        throw new ConflictException('Only failed operational alert deliveries can be retried.');
      }
      const updated = await transaction.operationalAlertOutboxEvent.updateMany({
        where: { id: eventId, status: NotificationOutboxStatus.FAILED },
        data: {
          status: NotificationOutboxStatus.PENDING,
          nextAttemptAt: now,
          claimedAt: null,
          processedAt: null,
          lastError: null,
        },
      });
      if (updated.count !== 1)
        throw new ConflictException('Operational alert state changed; reload before retrying.');
      await transaction.operationalAlertOutboxRecovery.create({
        data: {
          eventId,
          resolution: NotificationOutboxRecoveryResolution.RETRY_APPROVED,
          note,
          unknownReasonSnapshot: event.lastError,
          resolvedByUserId: actorUserId,
        },
      });
    });
  }

  private resolutionData(resolution: NotificationOutboxRecoveryResolution, now: Date) {
    if (resolution === NotificationOutboxRecoveryResolution.RETRY_APPROVED) {
      return {
        status: NotificationOutboxStatus.PENDING,
        nextAttemptAt: now,
        claimedAt: null,
        processedAt: null,
        lastError: null,
      };
    }

    return {
      status: NotificationOutboxStatus.SENT,
      claimedAt: null,
      processedAt: now,
      lastError: null,
    };
  }

  async listOutbox(query: ListNotificationOutboxQueryDto = {}) {
    const limit = query.limit ?? 200;
    const customerQuery = {
      where: { status: query.status },
      take: limit,
      orderBy: { updatedAt: 'desc' as const },
      select: {
        id: true,
        type: true,
        aggregateType: true,
        aggregateId: true,
        status: true,
        attempts: true,
        nextAttemptAt: true,
        claimedAt: true,
        processedAt: true,
        lastError: true,
        createdAt: true,
        updatedAt: true,
        recoveries: { take: 10, orderBy: { createdAt: 'desc' as const } },
      },
    };
    const operationalQuery = {
      where: { status: query.status },
      take: limit,
      orderBy: { updatedAt: 'desc' as const },
      select: {
        id: true,
        orderId: true,
        recipientPhone: true,
        code: true,
        level: true,
        priority: true,
        status: true,
        attempts: true,
        nextAttemptAt: true,
        claimedAt: true,
        processedAt: true,
        lastError: true,
        createdAt: true,
        updatedAt: true,
        recoveries: { take: 10, orderBy: { createdAt: 'desc' as const } },
      },
    };
    const [customer, operational, customerCounts, operationalCounts] = await Promise.all([
      query.source === 'OPERATIONAL'
        ? Promise.resolve([])
        : this.prisma.notificationOutboxEvent.findMany(customerQuery),
      query.source === 'CUSTOMER'
        ? Promise.resolve([])
        : this.prisma.operationalAlertOutboxEvent.findMany(operationalQuery),
      this.prisma.notificationOutboxEvent.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.operationalAlertOutboxEvent.groupBy({ by: ['status'], _count: { _all: true } }),
    ]);
    const items = [
      ...customer.map((event) => ({
        ...event,
        source: 'CUSTOMER' as const,
        eventType: event.type,
        recipientPhone: null,
        priority: null,
        level: null,
      })),
      ...operational.map((event) => ({
        ...event,
        source: 'OPERATIONAL' as const,
        eventType: event.code,
        aggregateType: 'ORDER',
        aggregateId: event.orderId,
      })),
    ]
      .sort((first, second) => second.updatedAt.getTime() - first.updatedAt.getTime())
      .slice(0, limit);
    const countByStatus = new Map<string, number>();
    for (const row of [...customerCounts, ...operationalCounts]) {
      countByStatus.set(row.status, (countByStatus.get(row.status) ?? 0) + row._count._all);
    }
    const count = (status: NotificationOutboxStatus) => countByStatus.get(status) ?? 0;
    const summary = {
      pending: count(NotificationOutboxStatus.PENDING),
      processing: count(NotificationOutboxStatus.PROCESSING),
      dispatching: count(NotificationOutboxStatus.DISPATCHING),
      sent: count(NotificationOutboxStatus.SENT),
      failed: count(NotificationOutboxStatus.FAILED),
      unknown: count(NotificationOutboxStatus.UNKNOWN),
    };
    return {
      items,
      summary: { ...summary, total: Object.values(summary).reduce((sum, value) => sum + value, 0) },
      generatedAt: new Date().toISOString(),
    };
  }
}
