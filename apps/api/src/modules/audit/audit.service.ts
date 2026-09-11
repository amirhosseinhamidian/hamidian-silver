import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import {
  resolveHumanAuditEvent,
  sanitizeHumanAuditEvent,
  type AuditChange,
  type AuditOperationType,
} from './audit-event';
import type { AuditOutcomeValue, ListAuditLogsQueryDto } from './dto/list-audit-logs-query.dto';

export type RecordAuditLogInput = Readonly<{
  actorUserId: string;
  action: string;
  title: string;
  operationType: AuditOperationType;
  entityName: string | null;
  changes: readonly AuditChange[];
  resource: string;
  resourceId: string | null;
  method: string;
  path: string;
  statusCode: number;
  outcome: AuditOutcomeValue;
  ipAddress: string | null;
  userAgent: string | null;
  requestId: string | null;
  durationMs: number;
  metadata: Record<string, unknown> | null;
}>;

type AuditRow = {
  id: string;
  actorUserId: string;
  actorPhone: string;
  actorFirstName: string | null;
  actorLastName: string | null;
  action: string;
  title: string | null;
  operationType: AuditOperationType | null;
  entityName: string | null;
  changes: AuditChange[] | null;
  resource: string;
  resourceId: string | null;
  method: string;
  path: string;
  statusCode: number;
  outcome: AuditOutcomeValue;
  ipAddress: string | null;
  userAgent: string | null;
  requestId: string | null;
  durationMs: number;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
};

type AuditSummaryRow = {
  total: bigint;
  succeeded: bigint;
  failed: bigint;
  actors: bigint;
  last24Hours: bigint;
};

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: RecordAuditLogInput): Promise<void> {
    const roleCodes = input.metadata?.roleCodes;
    const metadata =
      Array.isArray(roleCodes) && roleCodes.every((roleCode) => typeof roleCode === 'string')
        ? JSON.stringify({ roleCodes: roleCodes.slice(0, 20) })
        : null;
    const humanEvent = sanitizeHumanAuditEvent(input);
    const changes = humanEvent.changes.length ? JSON.stringify(humanEvent.changes) : null;
    await this.prisma.$executeRaw`
      INSERT INTO "audit_logs" (
        "actorUserId", "action", "title", "operationType", "entityName", "changes",
        "resource", "resourceId", "method", "path", "statusCode", "outcome",
        "ipAddress", "userAgent", "requestId", "durationMs", "metadata"
      ) VALUES (
        ${input.actorUserId}::uuid, ${input.action}, ${humanEvent.title},
        ${humanEvent.operationType}, ${humanEvent.entityName}, ${changes}::jsonb,
        ${input.resource}, ${input.resourceId}::uuid, ${input.method}, ${input.path},
        ${input.statusCode}, ${input.outcome}::"AuditOutcome", ${input.ipAddress},
        ${input.userAgent}, ${input.requestId}, ${input.durationMs}, ${metadata}::jsonb
      )
    `;
  }

  async list(query: ListAuditLogsQueryDto = {}) {
    const limit = query.limit ?? 200;
    const search = query.search?.trim() || null;
    const outcome = query.outcome ?? null;
    const operationType = query.operationType ?? null;
    const resource = query.resource?.trim() || null;
    const actorUserId = query.actorUserId ?? null;
    const from = query.from ? new Date(query.from) : null;
    const to = query.to ? new Date(query.to) : null;

    const [items, summaries, resources, operationTypes] = await Promise.all([
      this.prisma.$queryRaw<AuditRow[]>`
        SELECT
          a."id", a."actorUserId", u."phone" AS "actorPhone",
          u."firstName" AS "actorFirstName", u."lastName" AS "actorLastName",
          a."action", a."title", a."operationType", a."entityName", a."changes",
          a."resource", a."resourceId", a."method", a."path",
          a."statusCode", a."outcome", a."ipAddress", a."userAgent", a."requestId",
          a."durationMs", a."metadata", a."createdAt"
        FROM "audit_logs" a
        INNER JOIN "users" u ON u."id" = a."actorUserId"
        WHERE (${search}::text IS NULL OR
          a."action" ILIKE '%' || ${search} || '%' OR
          a."title" ILIKE '%' || ${search} || '%' OR
          a."entityName" ILIKE '%' || ${search} || '%' OR
          a."path" ILIKE '%' || ${search} || '%' OR
          a."requestId" ILIKE '%' || ${search} || '%' OR
          u."phone" ILIKE '%' || ${search} || '%')
          AND (${outcome}::text IS NULL OR a."outcome"::text = ${outcome})
          AND (${operationType}::text IS NULL OR a."operationType" = ${operationType})
          AND (${resource}::text IS NULL OR a."resource" = ${resource})
          AND (${actorUserId}::text IS NULL OR a."actorUserId" = ${actorUserId}::uuid)
          AND (${from}::timestamptz IS NULL OR a."createdAt" >= ${from})
          AND (${to}::timestamptz IS NULL OR a."createdAt" <= ${to})
        ORDER BY a."createdAt" DESC
        LIMIT ${limit}
      `,
      this.prisma.$queryRaw<AuditSummaryRow[]>`
        SELECT
          COUNT(*) AS "total",
          COUNT(*) FILTER (WHERE "outcome" = 'SUCCESS') AS "succeeded",
          COUNT(*) FILTER (WHERE "outcome" = 'FAILURE') AS "failed",
          COUNT(DISTINCT "actorUserId") AS "actors",
          COUNT(*) FILTER (WHERE "createdAt" >= NOW() - INTERVAL '24 hours') AS "last24Hours"
        FROM "audit_logs"
      `,
      this.prisma.$queryRaw<Array<{ resource: string }>>`
        SELECT DISTINCT "resource" FROM "audit_logs" ORDER BY "resource" ASC
      `,
      this.prisma.$queryRaw<Array<{ operationType: AuditOperationType }>>`
        SELECT DISTINCT "operationType"
        FROM "audit_logs"
        WHERE "operationType" IS NOT NULL
        ORDER BY "operationType" ASC
      `,
    ]);

    const summary = summaries[0] ?? {
      total: 0n,
      succeeded: 0n,
      failed: 0n,
      actors: 0n,
      last24Hours: 0n,
    };

    return {
      items: items.map((item) => {
        const fallback = resolveHumanAuditEvent(
          null,
          { action: item.action, resource: item.resource, method: item.method },
          item.outcome,
        );
        return {
          id: item.id,
          actor: {
            id: item.actorUserId,
            phone: item.actorPhone,
            name:
              [item.actorFirstName, item.actorLastName].filter(Boolean).join(' ').trim() || null,
          },
          title: item.title ?? fallback.title,
          operationType: item.operationType ?? fallback.operationType,
          entityName: item.entityName ?? fallback.entityName,
          changes: item.changes ?? [],
          action: item.action,
          resource: item.resource,
          resourceId: item.resourceId,
          method: item.method,
          path: item.path,
          statusCode: item.statusCode,
          outcome: item.outcome,
          ipAddress: item.ipAddress,
          userAgent: item.userAgent,
          requestId: item.requestId,
          durationMs: item.durationMs,
          metadata: item.metadata,
          createdAt: item.createdAt.toISOString(),
        };
      }),
      summary: {
        total: Number(summary.total),
        succeeded: Number(summary.succeeded),
        failed: Number(summary.failed),
        actors: Number(summary.actors),
        last24Hours: Number(summary.last24Hours),
      },
      resources: resources.map((entry) => entry.resource),
      operationTypes: operationTypes.map((entry) => entry.operationType),
      generatedAt: new Date().toISOString(),
    };
  }
}
