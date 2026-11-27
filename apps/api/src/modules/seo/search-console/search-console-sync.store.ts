import { Injectable } from '@nestjs/common';
import type { Prisma, SeoSyncRun } from '../../../generated/prisma/client';
import { SeoSyncStatus } from '../../../generated/prisma/enums';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { SearchConsoleError } from './search-console-errors';
import {
  aggregateDailyMetrics,
  dayLabel,
  type fetchDailyMetrics,
  type SyncSearchType,
  sha256,
  shiftDay,
} from './search-console-sync-data';
import { saveReportedUrls } from './search-console-url-inventory';

const leaseMs = 10 * 60_000;
const maxAttempts = 5;
const finalDataDelay = 3;
const refreshDays = 3;
type DailyData = Awaited<ReturnType<typeof fetchDailyMetrics>>;

function currentClaim(run: SeoSyncRun, now: Date): Prisma.SeoSyncRunWhereInput {
  return {
    id: run.id,
    status: SeoSyncStatus.RUNNING,
    attempts: run.attempts,
    leaseUntil: { gt: now },
  };
}

@Injectable()
export class SearchConsoleSyncStore {
  constructor(private readonly prisma: PrismaService) {}

  async plan(
    property: string,
    scheduledOn: Date,
    historyDays: number,
    searchTypes: readonly SyncSearchType[],
  ) {
    const integration =
      (await this.prisma.seoIntegration.findUnique({ where: { property } })) ??
      (await this.prisma.seoIntegration.upsert({
        where: { property },
        create: { property },
        update: { property },
      }));
    const plannedScope = `${historyDays}:${searchTypes.join(',')}`;
    if (
      integration.plannedOn?.getTime() === scheduledOn.getTime() &&
      integration.plannedScope === plannedScope
    ) {
      return integration.id;
    }
    await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.seoIntegration.updateMany({
        where: {
          id: integration.id,
          OR: [
            { plannedOn: null },
            { plannedOn: { lt: scheduledOn } },
            {
              plannedOn: scheduledOn,
              OR: [{ plannedScope: null }, { plannedScope: { not: plannedScope } }],
            },
          ],
        },
        data: { plannedOn: scheduledOn, plannedScope },
      });
      if (!claimed.count) return;
      const endDate = shiftDay(scheduledOn, -finalDataDelay);
      const startDate = shiftDay(endDate, 1 - historyDays);
      const recentFrom = shiftDay(endDate, 1 - refreshDays);
      const scheduledHistory = await tx.seoSyncRun.groupBy({
        by: ['metricDate', 'searchType'],
        where: {
          integrationId: integration.id,
          metricDate: { gte: startDate, lt: recentFrom },
          searchType: { in: [...searchTypes] },
          status: { not: SeoSyncStatus.FAILED },
        },
      });
      const covered = new Set(
        scheduledHistory.map(
          ({ metricDate, searchType }) => `${dayLabel(metricDate)}:${searchType}`,
        ),
      );
      const jobs: Prisma.SeoSyncRunCreateManyInput[] = [];
      for (
        let metricDate = endDate;
        metricDate >= startDate;
        metricDate = shiftDay(metricDate, -1)
      ) {
        for (const searchType of searchTypes) {
          if (metricDate >= recentFrom || !covered.has(`${dayLabel(metricDate)}:${searchType}`)) {
            jobs.push({ integrationId: integration.id, metricDate, scheduledOn, searchType });
          }
        }
      }
      if (jobs.length) await tx.seoSyncRun.createMany({ data: jobs, skipDuplicates: true });
    });
    return integration.id;
  }

  claim(integrationId: string, now: Date) {
    return this.prisma.$transaction(async (tx) => {
      const [integration] = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM "seo_integrations"
        WHERE id = ${integrationId}::uuid AND ("pausedUntil" IS NULL OR "pausedUntil" <= ${now})
        FOR NO KEY UPDATE SKIP LOCKED
      `;
      if (!integration) return null;
      const active = await tx.seoSyncRun.findFirst({
        where: { integrationId, status: SeoSyncStatus.RUNNING, leaseUntil: { gt: now } },
        select: { id: true },
      });
      if (active) return null;
      await tx.seoSyncRun.updateMany({
        where: {
          integrationId,
          status: SeoSyncStatus.RUNNING,
          leaseUntil: { lte: now },
          attempts: { gte: maxAttempts },
        },
        data: {
          status: SeoSyncStatus.FAILED,
          finishedAt: now,
          leaseUntil: null,
          errorCode: 'worker_interrupted',
        },
      });
      const claimable: Prisma.SeoSyncRunWhereInput = {
        integrationId,
        attempts: { lt: maxAttempts },
        OR: [
          { status: SeoSyncStatus.RUNNING, leaseUntil: { lte: now } },
          { status: SeoSyncStatus.PENDING, availableAt: { lte: now } },
        ],
      };
      const pending = await tx.seoSyncRun.findFirst({
        where: claimable,
        orderBy: [
          { status: 'desc' },
          { metricDate: 'desc' },
          { scheduledOn: 'desc' },
          { id: 'asc' },
        ],
        select: { id: true, attempts: true },
      });
      if (!pending) return null;
      const [claimed] = await tx.seoSyncRun.updateManyAndReturn({
        where: { id: pending.id, AND: [claimable, { attempts: pending.attempts }] },
        data: {
          status: SeoSyncStatus.RUNNING,
          startedAt: now,
          leaseUntil: new Date(now.getTime() + leaseMs),
          attempts: { increment: 1 },
        },
      });
      return claimed ?? null;
    });
  }

  complete(run: SeoSyncRun, data: DailyData) {
    return this.prisma.$transaction(
      async (tx) => {
        const now = new Date();
        const current = await tx.seoSyncRun.updateMany({
          where: currentClaim(run, now),
          data: {
            status: SeoSyncStatus.SUCCEEDED,
            leaseUntil: null,
            finishedAt: now,
            rowCount: data.rows.length,
            coverage: data.coverage,
            errorCode: null,
          },
        });
        if (!current.count) return false;
        const urls = await saveReportedUrls(
          tx,
          run.integrationId,
          data.rows.flatMap(({ reportedUrl }) => (reportedUrl ? [reportedUrl] : [])),
        );
        const rows = data.rows.map(({ reportedUrl, ...row }) => {
          const urlId = reportedUrl ? urls.get(sha256(reportedUrl)) : null;
          if (urlId === undefined) throw new Error('Search Console URL was not saved.');
          return { ...row, urlId };
        });
        if (rows.length) {
          await tx.$executeRaw`
          INSERT INTO "seo_performance_daily" (
            "integrationId", "metricDate", "searchType", "syncRunId", "sourceVersion",
            "dimensionKey", "scope", "aggregation", "device", "searchQuery", "brand",
            "brandSource", "clicks", "impressions", "averagePosition", "urlId"
          )
          SELECT ${run.integrationId}::uuid, ${dayLabel(run.metricDate)}::date, ${run.searchType},
                 ${run.id}::uuid, ${dayLabel(run.scheduledOn)}::date, incoming.*
          FROM jsonb_to_recordset(${JSON.stringify(rows)}::jsonb) AS incoming(
            "dimensionKey" text, "scope" text, "aggregation" text, "device" text, "searchQuery" text,
            "brand" text, "brandSource" text, "clicks" double precision, "impressions" double precision,
            "averagePosition" double precision, "urlId" uuid
          )
          ON CONFLICT ("integrationId", "metricDate", "dimensionKey") DO UPDATE SET
            "clicks" = EXCLUDED."clicks",
            "impressions" = EXCLUDED."impressions",
            "averagePosition" = EXCLUDED."averagePosition",
            "aggregation" = EXCLUDED."aggregation",
            "brandSource" = EXCLUDED."brandSource",
            "urlId" = EXCLUDED."urlId",
            "syncRunId" = EXCLUDED."syncRunId",
            "sourceVersion" = EXCLUDED."sourceVersion"
          WHERE "seo_performance_daily"."sourceVersion" <= EXCLUDED."sourceVersion"
        `;
        }
        return true;
      },
      { timeout: 20_000 },
    );
  }

  fail(run: SeoSyncRun, error: unknown) {
    const code = error instanceof SearchConsoleError ? error.code : 'sync_failed';
    const retryAfter =
      error instanceof SearchConsoleError ? Math.min(error.retryAfterSeconds ?? 0, 86_400) : 0;
    const cooldownSeconds = Math.max(
      retryAfter,
      code === 'quota_exceeded' ? 3_600 : error instanceof SearchConsoleError ? 300 : 0,
    );
    return this.prisma.$transaction(async (tx) => {
      // Keep the same lock order as claim before writing the integration cooldown.
      if (cooldownSeconds) {
        await tx.$queryRaw`
          SELECT id FROM "seo_integrations" WHERE id = ${run.integrationId}::uuid FOR NO KEY UPDATE
        `;
      }
      const now = new Date();
      const terminal = run.attempts >= maxAttempts;
      const pausedUntil = new Date(now.getTime() + cooldownSeconds * 1000);
      const availableAt = new Date(
        now.getTime() + Math.max(cooldownSeconds, 60 * 3 ** (run.attempts - 1)) * 1000,
      );
      const result = await tx.seoSyncRun.updateMany({
        where: currentClaim(run, now),
        data: {
          status: terminal ? SeoSyncStatus.FAILED : SeoSyncStatus.PENDING,
          finishedAt: terminal ? now : null,
          leaseUntil: null,
          availableAt,
          errorCode: code,
        },
      });
      if (result.count && cooldownSeconds) {
        await tx.seoIntegration.updateMany({
          where: {
            id: run.integrationId,
            OR: [{ pausedUntil: null }, { pausedUntil: { lt: pausedUntil } }],
          },
          data: { pausedUntil },
        });
      }
      return result.count > 0;
    });
  }

  async status(property: string, from?: Date, to?: Date) {
    const integration = await this.prisma.seoIntegration.findUnique({ where: { property } });
    if (!integration) return { property, status: 'not_started' };
    const integrationId = integration.id;
    const [queue, lastSuccess, recent, rollup] = await Promise.all([
      this.prisma.seoSyncRun.groupBy({ by: ['status'], where: { integrationId }, _count: true }),
      this.prisma.seoSyncRun.findFirst({
        where: { integrationId, status: SeoSyncStatus.SUCCEEDED },
        orderBy: [{ finishedAt: 'desc' }, { scheduledOn: 'desc' }, { id: 'desc' }],
        select: { finishedAt: true, metricDate: true, rowCount: true },
      }),
      this.prisma.seoSyncRun.findMany({
        where: { integrationId },
        orderBy: [
          { startedAt: { sort: 'desc', nulls: 'last' } },
          { metricDate: 'desc' },
          { id: 'asc' },
        ],
        take: 10,
        select: {
          status: true,
          metricDate: true,
          scheduledOn: true,
          searchType: true,
          attempts: true,
          startedAt: true,
          finishedAt: true,
          availableAt: true,
          leaseUntil: true,
          rowCount: true,
          coverage: true,
          errorCode: true,
        },
      }),
      from && to
        ? this.prisma.seoPerformanceDaily.findMany({
            where: {
              integrationId,
              metricDate: { gte: from, lte: to },
              searchType: 'web',
              scope: 'PROPERTY',
            },
            orderBy: { metricDate: 'asc' },
            select: {
              metricDate: true,
              clicks: true,
              impressions: true,
              averagePosition: true,
              sourceVersion: true,
            },
          })
        : undefined,
    ]);
    return {
      property,
      plannedOn: integration.plannedOn,
      pausedUntil: integration.pausedUntil,
      queue,
      lastSuccess,
      recent,
      webPropertyRollup: rollup
        ? { days: rollup, totals: aggregateDailyMetrics(rollup) }
        : undefined,
    };
  }
}
