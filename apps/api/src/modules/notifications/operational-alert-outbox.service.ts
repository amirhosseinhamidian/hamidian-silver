import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import { NotificationOutboxStatus, OperationalAlertLevel } from '../../generated/prisma/enums';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { ROLE_CODES, type RoleCode } from '../authorization/rbac.constants';

export type EnqueueOperationalAlertInput = {
  orderId: string;
  orderNumber: string;
  code: string;
  level: OperationalAlertLevel;
  priority: string;
  incidentFingerprint: string;
  dueAt: Date | null;
  payload: Record<string, string | number | boolean | null>;
};

@Injectable()
export class OperationalAlertOutboxService {
  constructor(private readonly prisma: PrismaService) {}

  async enqueueMany(
    inputs: EnqueueOperationalAlertInput[],
    recipientRoleCodes: readonly RoleCode[] = [ROLE_CODES.MANAGER, ROLE_CODES.ADMIN],
  ) {
    if (inputs.length === 0) {
      return {
        recipientCount: 0,
        candidateCount: 0,
        enqueuedCount: 0,
      };
    }

    const recipients = await this.prisma.user.findMany({
      where: {
        isActive: true,
        deletedAt: null,
        roles: {
          some: {
            role: {
              code: {
                in: [...recipientRoleCodes],
              },
              isActive: true,
              deletedAt: null,
            },
          },
        },
      },
      select: {
        id: true,
        phone: true,
      },
    });

    if (recipients.length === 0) {
      return {
        recipientCount: 0,
        candidateCount: inputs.length,
        enqueuedCount: 0,
      };
    }

    const rows: Prisma.OperationalAlertOutboxEventCreateManyInput[] = [];

    for (const input of inputs) {
      for (const recipient of recipients) {
        rows.push({
          orderId: input.orderId,
          recipientUserId: recipient.id,
          recipientPhone: recipient.phone,
          code: input.code,
          level: input.level,
          priority: input.priority,
          incidentFingerprint: input.incidentFingerprint,
          deduplicationKey: this.deduplicationKey(
            input.incidentFingerprint,
            input.level,
            recipient.id,
          ),
          dueAt: input.dueAt,
          payload: {
            ...input.payload,
            orderNumber: input.orderNumber,
          },
        });
      }
    }

    const created = await this.prisma.operationalAlertOutboxEvent.createMany({
      data: rows,
      skipDuplicates: true,
    });

    return {
      recipientCount: recipients.length,
      candidateCount: inputs.length,
      enqueuedCount: created.count,
    };
  }

  async deliverySummary() {
    const [groups, latest] = await Promise.all([
      this.prisma.operationalAlertOutboxEvent.groupBy({
        by: ['status'],
        _count: {
          _all: true,
        },
      }),
      this.prisma.operationalAlertOutboxEvent.aggregate({
        _max: {
          createdAt: true,
          processedAt: true,
        },
      }),
    ]);
    const counts: Record<NotificationOutboxStatus, number> = {
      [NotificationOutboxStatus.PENDING]: 0,
      [NotificationOutboxStatus.PROCESSING]: 0,
      [NotificationOutboxStatus.SENT]: 0,
      [NotificationOutboxStatus.FAILED]: 0,
    };

    for (const group of groups) {
      counts[group.status] = group._count._all;
    }

    return {
      pending: counts[NotificationOutboxStatus.PENDING],
      processing: counts[NotificationOutboxStatus.PROCESSING],
      sent: counts[NotificationOutboxStatus.SENT],
      failed: counts[NotificationOutboxStatus.FAILED],
      lastEnqueuedAt: latest._max.createdAt,
      lastProcessedAt: latest._max.processedAt,
    };
  }

  private deduplicationKey(
    fingerprint: string,
    level: OperationalAlertLevel,
    recipientUserId: string,
  ) {
    return `ops:${fingerprint}:${level.toLowerCase()}:user:${recipientUserId}`;
  }
}
