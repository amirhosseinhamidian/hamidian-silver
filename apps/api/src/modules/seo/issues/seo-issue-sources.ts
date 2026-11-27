import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { auditPath } from '../audit/seo-audit-crawl';
import type { GoogleIndex } from '../inspection/seo-index-observation';
import {
  indexSignal,
  issueDayMs,
  performanceSignals,
  technicalSignals,
  type IssueScope,
  type IssueSignal,
  type PerformanceSample,
  type PerformanceThresholds,
  type TechnicalSample,
} from './seo-issue-signals';

async function readPerformance(
  db: PrismaService,
  scope: IssueScope,
  now: Date,
  limits: PerformanceThresholds,
) {
  const [latest] = await db.$queryRaw<{ end: Date | null; version: Date | null }[]>`
    SELECT MAX(p."metricDate") AS "end", MAX(p."sourceVersion") AS version
    FROM "seo_performance_daily" p JOIN "seo_integrations" i ON i.id = p."integrationId"
    WHERE i.property = ${scope.property} AND p.scope = 'PAGE' AND p."searchType" = 'web'
  `;
  if (!latest?.end || !latest.version || now.getTime() - latest.end.getTime() > 10 * issueDayMs)
    return [];
  const boundary = new Date(latest.end.getTime() - (limits.days - 1) * issueDayMs);
  const start = new Date(boundary.getTime() - limits.days * issueDayMs);
  const prefix = scope.origin + '/';
  const rows = await db.$queryRaw<PerformanceSample[]>`
    SELECT u."reportedUrl" AS url,
      COUNT(DISTINCT p."metricDate") FILTER (WHERE p."metricDate" < ${boundary}::date)::int AS "previousDays",
      COUNT(DISTINCT p."metricDate") FILTER (WHERE p."metricDate" >= ${boundary}::date)::int AS "currentDays",
      COUNT(DISTINCT p.aggregation)::int AS "aggregationCount",
      COALESCE(SUM(p.clicks) FILTER (WHERE p."metricDate" < ${boundary}::date), 0) AS "previousClicks",
      COALESCE(SUM(p.clicks) FILTER (WHERE p."metricDate" >= ${boundary}::date), 0) AS "currentClicks",
      COALESCE(SUM(p.impressions) FILTER (WHERE p."metricDate" < ${boundary}::date), 0) AS "previousImpressions",
      COALESCE(SUM(p.impressions) FILTER (WHERE p."metricDate" >= ${boundary}::date), 0) AS "currentImpressions"
    FROM "seo_performance_daily" p
    JOIN "seo_integrations" i ON i.id = p."integrationId"
    JOIN "seo_url_inventory" u ON u.id = p."urlId"
    WHERE i.property = ${scope.property} AND p.scope = 'PAGE' AND p."searchType" = 'web'
      AND p.aggregation IN ('byPage') AND p."metricDate" BETWEEN ${start}::date AND ${latest.end}::date
      AND u."reportedSearch" IS NULL AND left(u."reportedUrl", length(${prefix})) = ${prefix}
    GROUP BY u."reportedUrl"
    HAVING COUNT(DISTINCT p."metricDate") = ${limits.days * 2}
    ORDER BY "previousImpressions" DESC, url LIMIT 160
  `;
  const observedAt = new Date(Math.max(latest.end.getTime(), latest.version.getTime()));
  return rows
    .filter(({ url }) => Boolean(auditPath(scope.origin, url)))
    .flatMap((row) => performanceSignals(row, latest.end!, observedAt, limits));
}

async function readTechnical(db: PrismaService, origin: string) {
  return db.$queryRaw<TechnicalSample[]>(Prisma.sql`
    WITH runs AS (
      SELECT id FROM "seo_audit_runs"
      WHERE origin = ${origin} AND "finishedAt" IS NOT NULL
      ORDER BY "finishedAt" DESC, id DESC LIMIT 8
    ), ordered AS (
      SELECT c.path, c."runId", c.observation, c.issues, c."checkedAt", c."inSitemap",
        row_number() OVER (PARTITION BY c.path ORDER BY c."checkedAt" DESC, c."runId" DESC) AS check_number
      FROM "seo_audit_checks" c JOIN runs r ON r.id = c."runId"
      WHERE c."checkedAt" IS NOT NULL
    )
    SELECT path, "runId", observation, issues, "checkedAt", "inSitemap"
    FROM ordered WHERE check_number <= 2 ORDER BY path, check_number
  `);
}

export async function readIssueSignals(
  db: PrismaService,
  scope: IssueScope,
  now: Date,
  limits: PerformanceThresholds,
): Promise<IssueSignal[]> {
  const since = new Date(now.getTime() - 14 * issueDayMs);
  const [performance, samples, indexed] = await Promise.all([
    readPerformance(db, scope, now, limits),
    readTechnical(db, scope.origin),
    db.seoInspectionTarget.findMany({
      where: { ...scope, observedAt: { gte: since } },
      select: { path: true, observedAt: true, observation: true },
      orderBy: [{ observedAt: 'desc' }, { path: 'asc' }],
      take: 160,
    }),
  ]);
  const technical = new Map<string, TechnicalSample[]>();
  for (const sample of samples) {
    const checks = technical.get(sample.path) ?? [];
    checks.push(sample);
    technical.set(sample.path, checks);
  }
  const signals = [...performance];
  for (const [current, previous] of technical.values()) {
    if (current.checkedAt >= since)
      signals.push(...technicalSignals(scope.origin, current, previous));
  }
  for (const row of indexed) {
    const google = row.observation as GoogleIndex | null;
    if (!google || !row.observedAt) continue;
    const signal = indexSignal(
      scope.origin,
      row.path,
      row.observedAt,
      google,
      technical.get(row.path)?.[0],
    );
    if (signal) signals.push(signal);
  }
  return signals;
}
