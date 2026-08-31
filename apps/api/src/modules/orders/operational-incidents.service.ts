import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import {
  OperationalIncidentActivityType,
  OperationalIncidentResolutionSource,
} from '../../generated/prisma/enums';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { ROLE_CODES } from '../authorization/rbac.constants';
import { AddOperationalIncidentNoteDto } from './dto/add-operational-incident-note.dto';
import { AssignOperationalIncidentDto } from './dto/assign-operational-incident.dto';
import {
  type OperationalIncidentListStatus,
  ListOperationalIncidentsQueryDto,
} from './dto/list-operational-incidents-query.dto';
import {
  buildOperationalIncidentDescriptor,
  isOperationalAlertItem,
  type OperationalIncidentDescriptor,
} from './operational-alerts';
import type { OperationsWorkItem } from './operations-work-queue';

type SyncResult = 'CREATED' | 'ACTIVE' | 'REOPENED';

@Injectable()
export class OperationalIncidentsService {
  constructor(private readonly prisma: PrismaService) {}

  async syncFromWorkItems(items: OperationsWorkItem[], now = new Date()) {
    const descriptors = items.filter(isOperationalAlertItem).map((item) => {
      const descriptor = buildOperationalIncidentDescriptor(item);

      if (!descriptor) {
        throw new Error(
          `Operational alert item ${item.code} for order ${item.orderId} has no stable incident timestamp.`,
        );
      }

      return descriptor;
    });
    const fingerprints = [...new Set(descriptors.map((item) => item.incidentFingerprint))];
    let createdCount = 0;
    let reopenedCount = 0;

    for (const descriptor of descriptors) {
      const result = await this.syncOne(descriptor, now);

      if (result === 'CREATED') {
        createdCount += 1;
      } else if (result === 'REOPENED') {
        reopenedCount += 1;
      }
    }

    const resolvedCount = await this.autoResolveMissing(fingerprints, now);

    return {
      activeCount: fingerprints.length,
      createdCount,
      reopenedCount,
      resolvedCount,
    };
  }

  async list(query: ListOperationalIncidentsQueryDto, currentUserId: string) {
    const where: Prisma.OperationalIncidentWhereInput = {
      ...this.statusWhere(query.status),
      code: query.code,
      assignedToUserId: query.assignedToMe ? currentUserId : undefined,
    };

    const incidents = await this.prisma.operationalIncident.findMany({
      where,
      take: query.limit ?? 50,
      orderBy: [{ resolvedAt: 'asc' }, { lastDetectedAt: 'desc' }],
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
          },
        },
        acknowledgedBy: {
          select: this.actorSelect(),
        },
        assignedTo: {
          select: this.actorSelect(),
        },
      },
    });

    return incidents.map((incident) => ({
      ...incident,
      workflowStatus: this.workflowStatus(incident),
    }));
  }

  async get(incidentId: string) {
    const incident = await this.prisma.operationalIncident.findUnique({
      where: {
        id: incidentId,
      },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
          },
        },
        acknowledgedBy: {
          select: this.actorSelect(),
        },
        assignedTo: {
          select: this.actorSelect(),
        },
        activities: {
          orderBy: {
            createdAt: 'asc',
          },
          include: {
            actor: {
              select: this.actorSelect(),
            },
          },
        },
      },
    });

    if (!incident) {
      throw new NotFoundException('Operational incident was not found.');
    }

    return {
      ...incident,
      workflowStatus: this.workflowStatus(incident),
    };
  }

  async acknowledge(incidentId: string, actorUserId: string) {
    await this.prisma.$transaction(async (transaction) => {
      const current = await transaction.operationalIncident.findUnique({
        where: {
          id: incidentId,
        },
        select: {
          id: true,
          resolvedAt: true,
          acknowledgedAt: true,
        },
      });

      if (!current) {
        throw new NotFoundException('Operational incident was not found.');
      }

      if (current.resolvedAt) {
        throw new ConflictException('Resolved incidents cannot be acknowledged.');
      }

      if (current.acknowledgedAt) {
        return;
      }

      const acknowledgedAt = new Date();
      const claimed = await transaction.operationalIncident.updateMany({
        where: {
          id: current.id,
          resolvedAt: null,
          acknowledgedAt: null,
        },
        data: {
          acknowledgedAt,
          acknowledgedByUserId: actorUserId,
        },
      });

      if (claimed.count !== 1) {
        const changed = await transaction.operationalIncident.findUnique({
          where: {
            id: current.id,
          },
          select: {
            resolvedAt: true,
            acknowledgedAt: true,
          },
        });

        if (changed?.acknowledgedAt && !changed.resolvedAt) {
          return;
        }

        throw new ConflictException('Operational incident state changed; reload and retry.');
      }

      await transaction.operationalIncidentActivity.create({
        data: {
          incidentId: current.id,
          type: OperationalIncidentActivityType.ACKNOWLEDGED,
          actorUserId,
          metadata: {},
        },
      });
    });

    return this.get(incidentId);
  }

  async assign(incidentId: string, dto: AssignOperationalIncidentDto, actorUserId: string) {
    await this.prisma.$transaction(async (transaction) => {
      await this.assertAssignableStaff(transaction, dto.userId);

      const current = await transaction.operationalIncident.findUnique({
        where: {
          id: incidentId,
        },
        select: {
          id: true,
          resolvedAt: true,
          assignedToUserId: true,
        },
      });

      if (!current) {
        throw new NotFoundException('Operational incident was not found.');
      }

      if (current.resolvedAt) {
        throw new ConflictException('Resolved incidents cannot be assigned.');
      }

      if (current.assignedToUserId === dto.userId) {
        return;
      }

      const updated = await transaction.operationalIncident.updateMany({
        where: {
          id: current.id,
          resolvedAt: null,
          assignedToUserId: current.assignedToUserId,
        },
        data: {
          assignedToUserId: dto.userId,
        },
      });

      if (updated.count !== 1) {
        throw new ConflictException('Incident assignment changed; reload and retry.');
      }

      await transaction.operationalIncidentActivity.create({
        data: {
          incidentId: current.id,
          type: OperationalIncidentActivityType.ASSIGNED,
          actorUserId,
          metadata: {
            assignedToUserId: dto.userId,
            previousAssignedToUserId: current.assignedToUserId,
          },
        },
      });
    });

    return this.get(incidentId);
  }

  async unassign(incidentId: string, actorUserId: string) {
    await this.prisma.$transaction(async (transaction) => {
      const current = await transaction.operationalIncident.findUnique({
        where: {
          id: incidentId,
        },
        select: {
          id: true,
          resolvedAt: true,
          assignedToUserId: true,
        },
      });

      if (!current) {
        throw new NotFoundException('Operational incident was not found.');
      }

      if (current.resolvedAt) {
        throw new ConflictException('Resolved incidents cannot be unassigned.');
      }

      if (!current.assignedToUserId) {
        return;
      }

      const updated = await transaction.operationalIncident.updateMany({
        where: {
          id: current.id,
          resolvedAt: null,
          assignedToUserId: current.assignedToUserId,
        },
        data: {
          assignedToUserId: null,
        },
      });

      if (updated.count !== 1) {
        throw new ConflictException('Incident assignment changed; reload and retry.');
      }

      await transaction.operationalIncidentActivity.create({
        data: {
          incidentId: current.id,
          type: OperationalIncidentActivityType.UNASSIGNED,
          actorUserId,
          metadata: {
            previousAssignedToUserId: current.assignedToUserId,
          },
        },
      });
    });

    return this.get(incidentId);
  }

  async addNote(incidentId: string, dto: AddOperationalIncidentNoteDto, actorUserId: string) {
    const note = dto.note.trim();

    if (!note) {
      throw new BadRequestException('Incident note cannot be empty.');
    }

    await this.prisma.$transaction(async (transaction) => {
      const incident = await transaction.operationalIncident.findUnique({
        where: {
          id: incidentId,
        },
        select: {
          id: true,
        },
      });

      if (!incident) {
        throw new NotFoundException('Operational incident was not found.');
      }

      await transaction.operationalIncidentActivity.create({
        data: {
          incidentId: incident.id,
          type: OperationalIncidentActivityType.NOTE_ADDED,
          actorUserId,
          note,
          metadata: {},
        },
      });
    });

    return this.get(incidentId);
  }

  private async syncOne(descriptor: OperationalIncidentDescriptor, now: Date): Promise<SyncResult> {
    return this.prisma.$transaction(async (transaction) => {
      const incident = await transaction.operationalIncident.upsert({
        where: {
          incidentFingerprint: descriptor.incidentFingerprint,
        },
        update: {
          priority: descriptor.priority,
          dueAt: descriptor.dueAt,
          lastDetectedAt: now,
          snapshot: descriptor.payload,
        },
        create: {
          incidentFingerprint: descriptor.incidentFingerprint,
          orderId: descriptor.orderId,
          code: descriptor.code,
          priority: descriptor.priority,
          incidentAt: descriptor.incidentAt,
          dueAt: descriptor.dueAt,
          firstDetectedAt: now,
          lastDetectedAt: now,
          snapshot: descriptor.payload,
        },
      });

      const detected = await transaction.operationalIncidentActivity.createMany({
        data: [
          {
            incidentId: incident.id,
            type: OperationalIncidentActivityType.DETECTED,
            activityKey: `detected:${descriptor.incidentFingerprint}`,
            metadata: {
              incidentAt: descriptor.incidentAt.toISOString(),
            },
          },
        ],
        skipDuplicates: true,
      });

      if (!incident.resolvedAt) {
        return detected.count === 1 ? 'CREATED' : 'ACTIVE';
      }

      const reopened = await transaction.operationalIncident.updateMany({
        where: {
          id: incident.id,
          resolvedAt: incident.resolvedAt,
        },
        data: {
          resolvedAt: null,
          resolutionSource: null,
          resolutionNote: null,
          acknowledgedAt: null,
          acknowledgedByUserId: null,
          assignedToUserId: null,
          priority: descriptor.priority,
          dueAt: descriptor.dueAt,
          lastDetectedAt: now,
          snapshot: descriptor.payload,
        },
      });

      if (reopened.count !== 1) {
        return 'ACTIVE';
      }

      await transaction.operationalIncidentActivity.createMany({
        data: [
          {
            incidentId: incident.id,
            type: OperationalIncidentActivityType.REOPENED,
            activityKey: `reopened:${incident.id}:${incident.resolvedAt.toISOString()}`,
            metadata: {
              previousResolvedAt: incident.resolvedAt.toISOString(),
            },
          },
        ],
        skipDuplicates: true,
      });

      return 'REOPENED';
    });
  }

  private async autoResolveMissing(activeFingerprints: string[], now: Date): Promise<number> {
    const missing = await this.prisma.operationalIncident.findMany({
      where: {
        resolvedAt: null,
        ...(activeFingerprints.length > 0
          ? {
              incidentFingerprint: {
                notIn: activeFingerprints,
              },
            }
          : {}),
      },
      select: {
        id: true,
        incidentFingerprint: true,
      },
    });
    let resolvedCount = 0;

    for (const incident of missing) {
      const resolved = await this.prisma.$transaction(async (transaction) => {
        const claimed = await transaction.operationalIncident.updateMany({
          where: {
            id: incident.id,
            resolvedAt: null,
          },
          data: {
            resolvedAt: now,
            resolutionSource: OperationalIncidentResolutionSource.AUTO,
            resolutionNote: 'Incident no longer present in the operational work queue.',
          },
        });

        if (claimed.count !== 1) {
          return false;
        }

        await transaction.operationalIncidentActivity.create({
          data: {
            incidentId: incident.id,
            type: OperationalIncidentActivityType.RESOLVED,
            activityKey: `resolved:${incident.id}:${now.toISOString()}`,
            note: 'Incident automatically resolved after leaving the operational work queue.',
            metadata: {
              resolutionSource: OperationalIncidentResolutionSource.AUTO,
            },
          },
        });

        return true;
      });

      if (resolved) {
        resolvedCount += 1;
      }
    }

    return resolvedCount;
  }

  private statusWhere(
    status?: OperationalIncidentListStatus,
  ): Prisma.OperationalIncidentWhereInput {
    switch (status) {
      case 'OPEN':
        return {
          resolvedAt: null,
          acknowledgedAt: null,
        };
      case 'ACKNOWLEDGED':
        return {
          resolvedAt: null,
          acknowledgedAt: {
            not: null,
          },
        };
      case 'RESOLVED':
        return {
          resolvedAt: {
            not: null,
          },
        };
      case undefined:
        return {};
    }
  }

  private async assertAssignableStaff(transaction: Prisma.TransactionClient, userId: string) {
    const user = await transaction.user.findFirst({
      where: {
        id: userId,
        isActive: true,
        deletedAt: null,
        roles: {
          some: {
            role: {
              code: {
                in: [ROLE_CODES.MANAGER, ROLE_CODES.ADMIN],
              },
              isActive: true,
              deletedAt: null,
            },
          },
        },
      },
      select: {
        id: true,
      },
    });

    if (!user) {
      throw new BadRequestException('Incident can only be assigned to an active manager or admin.');
    }
  }

  private workflowStatus(incident: {
    resolvedAt: Date | null;
    acknowledgedAt: Date | null;
  }): OperationalIncidentListStatus {
    if (incident.resolvedAt) {
      return 'RESOLVED';
    }

    return incident.acknowledgedAt ? 'ACKNOWLEDGED' : 'OPEN';
  }

  private actorSelect() {
    return {
      id: true,
      phone: true,
      firstName: true,
      lastName: true,
    };
  }
}
