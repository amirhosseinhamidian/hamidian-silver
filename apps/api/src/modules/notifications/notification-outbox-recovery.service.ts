import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  NotificationOutboxRecoveryResolution,
  NotificationOutboxStatus,
} from '../../generated/prisma/enums';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import type { ResolveNotificationOutboxRecoveryDto } from './dto/resolve-notification-outbox-recovery.dto';

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
}
