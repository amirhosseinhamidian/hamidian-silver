import { Prisma } from '../../../generated/prisma/client';
import type {
  SearchOverviewMetricsDto,
  SearchOverviewQueryDto,
  SearchOverviewRowsQueryDto,
} from '../dto/search-overview.dto';

export type OverviewDayRow = {
  date: string;
  clicks: number | null;
  impressions: number | null;
  averagePosition: number | null;
};

type StoredFilters = Pick<SearchOverviewQueryDto, 'device' | 'brand'>;
export type ReportWindow = {
  integrationId: string | null;
  searchType: string;
  startDate: string;
  endDate: string;
};

export function latestSuccessfulRuns(window: ReportWindow) {
  return Prisma.sql`latest AS MATERIALIZED (
    SELECT DISTINCT ON (run."metricDate") run.id, run."metricDate", run.coverage
    FROM seo_sync_runs run
    WHERE run."integrationId" = ${window.integrationId}::uuid
      AND run."searchType" = ${window.searchType} AND run.status = 'SUCCEEDED'
      AND run."metricDate" BETWEEN ${window.startDate}::date AND ${window.endDate}::date
    ORDER BY run."metricDate", run."scheduledOn" DESC, run."finishedAt" DESC NULLS LAST, run.id DESC
  )`;
}

export function overviewDaysQuery(window: ReportWindow, filters: StoredFilters) {
  const scope = filters.brand ? 'BRAND' : filters.device ? 'DEVICE' : 'PROPERTY';
  const segment = filters.brand
    ? Prisma.sql`AND data.brand = ${filters.brand} AND data."brandSource" = 'google'`
    : filters.device
      ? Prisma.sql`AND UPPER(data.device) = ${filters.device}`
      : Prisma.empty;
  return Prisma.sql`
    WITH ${latestSuccessfulRuns(window)}
    SELECT to_char(latest."metricDate", 'YYYY-MM-DD') AS date,
      data.clicks, data.impressions, data."averagePosition"
    FROM latest
    LEFT JOIN seo_performance_daily data ON data."syncRunId" = latest.id
      AND data.scope = ${scope} ${segment}
    ORDER BY latest."metricDate"
  `;
}

export type OverviewTableRow = {
  total: number;
  syncedDays: number;
  cappedDays: number;
  items: (SearchOverviewMetricsDto & { label: string })[];
};

export function overviewRowsQuery(
  window: ReportWindow,
  query: SearchOverviewRowsQueryDto,
  page: number,
  limit: number,
) {
  const byQuery = query.kind === 'query';
  const scope = byQuery ? 'QUERY' : query.device ? 'PAGE_DEVICE' : 'PAGE';
  const value = byQuery ? Prisma.sql`data."searchQuery"` : Prisma.sql`url."reportedUrl"`;
  const urlJoin = byQuery
    ? Prisma.empty
    : Prisma.sql`JOIN seo_url_inventory url ON url.id = data."urlId"`;
  const device = query.device ? Prisma.sql`AND UPPER(data.device) = ${query.device}` : Prisma.empty;
  const term = query.q?.trim();
  const search = term ? Prisma.sql`AND strpos(lower(${value}), lower(${term})) > 0` : Prisma.empty;
  const sortColumns = {
    clicks: Prisma.sql`clicks`,
    impressions: Prisma.sql`impressions`,
    ctr: Prisma.sql`ctr`,
    position: Prisma.sql`"averagePosition"`,
    label: Prisma.sql`label COLLATE "C"`,
  };
  const order = Prisma.sql`${sortColumns[query.sort ?? 'clicks']}
    ${query.direction === 'asc' ? Prisma.sql`ASC` : Prisma.sql`DESC`} NULLS LAST, label COLLATE "C" ASC`;
  return Prisma.sql`
    WITH ${latestSuccessfulRuns(window)}, groups AS (
      SELECT ${value} AS label, SUM(data.clicks) AS clicks, SUM(data.impressions) AS impressions,
        SUM(data.clicks) / NULLIF(SUM(data.impressions), 0) AS ctr,
        CASE WHEN SUM(data.impressions) =
          COALESCE(SUM(data.impressions) FILTER (WHERE data."averagePosition" IS NOT NULL), 0)
        THEN SUM(data."averagePosition" * data.impressions) / NULLIF(SUM(data.impressions), 0) END AS "averagePosition"
      FROM latest
      JOIN seo_performance_daily data ON data."syncRunId" = latest.id AND data.scope = ${scope}
      ${urlJoin}
      WHERE ${value} IS NOT NULL ${device} ${search}
      GROUP BY ${value}
    ), selected AS (
      SELECT * FROM groups ORDER BY ${order} LIMIT ${limit} OFFSET ${(page - 1) * limit}
    )
    SELECT (SELECT COUNT(*)::int FROM groups) AS total,
      (SELECT COUNT(*)::int FROM latest) AS "syncedDays",
      (SELECT COUNT(*)::int FROM latest WHERE coverage -> ${scope}::text ->> 'capped' = 'true') AS "cappedDays",
      COALESCE((SELECT jsonb_agg(to_jsonb(selected) ORDER BY ${order}) FROM selected), '[]'::jsonb) AS items
  `;
}
