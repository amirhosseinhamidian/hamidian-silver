import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { latestSuccessfulRuns } from '../search-console/search-overview-query';
import {
  opportunityMetricWindow,
  shiftOpportunityDay,
  type OpportunityScope,
} from './seo-opportunity-sources';
import type { OpportunityMetrics } from './seo-opportunity-rules';

export type OpportunityImpact = {
  status: 'READY' | 'WAITING_FOR_DATA';
  before: OpportunityMetrics;
  after: OpportunityMetrics;
  clickDifference: number | null;
  impressionDifference: number | null;
  ctrPointDifference: number | null;
};

export async function measureOpportunityImpact(
  db: PrismaService,
  scope: OpportunityScope,
  url: string,
  implementedOn: string,
  days: number,
): Promise<OpportunityImpact> {
  const before = {
    start: shiftOpportunityDay(implementedOn, -days),
    end: shiftOpportunityDay(implementedOn, -1),
  };
  const after = {
    start: shiftOpportunityDay(implementedOn, 1),
    end: shiftOpportunityDay(implementedOn, days),
  };
  const integration = await db.seoIntegration.findUnique({
    where: { property: scope.property },
    select: { id: true },
  });
  const rows = integration
    ? await db.$queryRaw<
        {
          period: string;
          observedDays: number;
          cappedDays: number;
          clicks: number | null;
          impressions: number | null;
          position: number | null;
        }[]
      >(Prisma.sql`
    WITH ${latestSuccessfulRuns({ integrationId: integration.id, searchType: 'web', startDate: before.start, endDate: after.end })},
    daily AS (
      SELECT CASE WHEN latest."metricDate" < ${implementedOn}::date THEN 'before' ELSE 'after' END AS period,
        latest."metricDate", latest.coverage #>> '{PAGE,capped}' = 'true' AS capped,
        p.clicks, p.impressions, p."averagePosition"
      FROM latest
      LEFT JOIN seo_performance_daily p ON p."syncRunId" = latest.id AND p.scope = 'PAGE' AND p.aggregation = 'byPage'
        AND p."urlId" IN (SELECT id FROM seo_url_inventory
          WHERE "integrationId" = ${integration.id}::uuid AND "reportedUrl" = ${url} AND "reportedSearch" IS NULL)
      WHERE latest."metricDate" <> ${implementedOn}::date
    )
    SELECT period, COUNT(DISTINCT "metricDate") FILTER (WHERE clicks IS NOT NULL)::int AS "observedDays",
      COUNT(DISTINCT "metricDate") FILTER (WHERE capped)::int AS "cappedDays",
      SUM(clicks) AS clicks, SUM(impressions) AS impressions,
      CASE WHEN SUM(impressions) = COALESCE(SUM(impressions) FILTER (WHERE "averagePosition" IS NOT NULL), 0)
        THEN SUM("averagePosition" * impressions) / NULLIF(SUM(impressions), 0) END AS position
    FROM daily GROUP BY period
  `)
    : [];
  const empty = { observedDays: 0, cappedDays: 0, clicks: null, impressions: null, position: null };
  const prior = opportunityMetricWindow(
    before,
    rows.find(({ period }) => period === 'before') ?? empty,
  );
  const later = opportunityMetricWindow(
    after,
    rows.find(({ period }) => period === 'after') ?? empty,
  );
  const complete = prior.observedDays === days && later.observedDays === days;
  return {
    status: complete ? 'READY' : 'WAITING_FOR_DATA',
    before: prior,
    after: later,
    clickDifference:
      prior.clicks !== null && later.clicks !== null ? later.clicks - prior.clicks : null,
    impressionDifference:
      prior.impressions !== null && later.impressions !== null
        ? later.impressions - prior.impressions
        : null,
    ctrPointDifference:
      prior.ctr !== null && later.ctr !== null ? (later.ctr - prior.ctr) * 100 : null,
  };
}
