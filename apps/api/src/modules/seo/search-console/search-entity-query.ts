import { Prisma } from '../../../generated/prisma/client';
import type {
  SearchEntityListQueryDto,
  SearchEntityListItemDto,
  SeoEntityKind,
} from '../dto/search-entity.dto';
import type { SearchOverviewRowDto } from '../dto/search-overview.dto';
import { latestSuccessfulRuns, type ReportWindow } from './search-overview-query';

export const seoEntitySources = {
  product: {
    table: Prisma.sql`products`,
    title: Prisma.sql`entity.name`,
    visible: Prisma.sql`entity.status = 'ACTIVE'`,
    foreignKey: 'productId',
    column: Prisma.sql`inventory."productId"`,
    path: '/products/',
  },
  category: {
    table: Prisma.sql`categories`,
    title: Prisma.sql`entity.name`,
    visible: Prisma.sql`entity."isActive"`,
    foreignKey: 'categoryId',
    column: Prisma.sql`inventory."categoryId"`,
    path: '/categories/',
  },
  brand: {
    table: Prisma.sql`brands`,
    title: Prisma.sql`entity.name`,
    visible: Prisma.sql`entity."isActive"`,
    foreignKey: 'brandId',
    column: Prisma.sql`inventory."brandId"`,
    path: '/brands/',
  },
  article: {
    table: Prisma.sql`guide_articles`,
    title: Prisma.sql`entity.title`,
    visible: Prisma.sql`entity.status = 'PUBLISHED' AND entity."publishedAt" <= CURRENT_TIMESTAMP`,
    foreignKey: 'articleId',
    column: Prisma.sql`inventory."articleId"`,
    path: '/guide/',
  },
} as const;

export type EntitySourceRow = {
  id: string;
  name: string;
  slug: string;
  seoCanonicalPath: string | null;
  seoNoIndex: boolean;
};

export function entitySourceQuery(kind: SeoEntityKind, filter: { id?: string; text?: string }) {
  const { table, title, visible } = seoEntitySources[kind];
  const id = filter.id ? Prisma.sql`AND entity.id = ${filter.id}::uuid` : Prisma.empty;
  const search = filter.text
    ? Prisma.sql`AND (
    strpos(lower(${title}), lower(${filter.text})) > 0 OR strpos(lower(entity.slug), lower(${filter.text})) > 0
  )`
    : Prisma.empty;
  return Prisma.sql`
    SELECT entity.id, ${title} AS name, entity.slug, entity."seoCanonicalPath", entity."seoNoIndex"
    FROM ${table} entity WHERE entity."deletedAt" IS NULL AND ${visible} ${id} ${search}
  `;
}

export type EntityScores = Pick<
  SearchEntityListItemDto,
  'id' | 'clicks' | 'impressions' | 'ctr' | 'clickChangePercent' | 'sufficient' | 'opportunities'
>;
type Candidate = { id: string; name: string; urlKey: string; seoNoIndex: boolean };

export function entityScoresQuery(
  window: ReportWindow,
  currentStart: string,
  days: number,
  candidates: Candidate[],
  query: SearchEntityListQueryDto,
  page: number,
  limit: number,
) {
  const minimumImpressions = query.minimumImpressions ?? 100;
  const maximumCtr = (query.maximumCtrPercent ?? 2) / 100;
  const minimumChange = query.minimumChangePercent ?? 20;
  const minimumPreviousClicks = query.minimumPreviousClicks ?? 10;
  const column = seoEntitySources[query.kind].column;
  const opportunity = query.opportunity
    ? Prisma.sql`WHERE ${query.opportunity} = ANY(opportunities)`
    : Prisma.empty;
  const order = Prisma.sql`impressions DESC NULLS LAST, name COLLATE "C", id`;
  return Prisma.sql`
    WITH ${latestSuccessfulRuns(window)}, candidates AS MATERIALIZED (
      SELECT * FROM jsonb_to_recordset(${JSON.stringify(candidates)}::jsonb)
      AS incoming(id uuid, name text, "urlKey" char(64), "seoNoIndex" boolean)
    ), mapped AS (
      SELECT candidates.*, inventory.id AS "urlId" FROM candidates
      LEFT JOIN seo_url_inventory inventory ON inventory."integrationId" = ${window.integrationId}::uuid
        AND inventory."urlKey" = candidates."urlKey" AND ${column} = candidates.id
    ), totals AS (
      SELECT data."urlId",
        SUM(data.clicks) FILTER (WHERE data."metricDate" >= ${currentStart}::date) AS clicks,
        SUM(data.impressions) FILTER (WHERE data."metricDate" >= ${currentStart}::date) AS impressions,
        COUNT(DISTINCT data."metricDate") FILTER (WHERE data."metricDate" >= ${currentStart}::date) AS current_days,
        SUM(data.clicks) FILTER (WHERE data."metricDate" < ${currentStart}::date) AS previous_clicks,
        SUM(data.impressions) FILTER (WHERE data."metricDate" < ${currentStart}::date) AS previous_impressions,
        COUNT(DISTINCT data."metricDate") FILTER (WHERE data."metricDate" < ${currentStart}::date) AS previous_days
      FROM latest JOIN seo_performance_daily data ON data."syncRunId" = latest.id AND data.scope = 'PAGE'
      JOIN mapped ON mapped."urlId" = data."urlId"
      GROUP BY data."urlId"
    ), ranked AS (
      SELECT mapped.id, mapped.name, mapped."seoNoIndex", totals.clicks, totals.impressions,
        totals.clicks / NULLIF(totals.impressions, 0) AS ctr,
        COALESCE(totals.current_days = ${days}::int AND totals.impressions >= ${minimumImpressions}::int, FALSE) AS sufficient,
        CASE WHEN totals.current_days = ${days}::int AND totals.previous_days = ${days}::int
          AND totals.impressions >= ${minimumImpressions}::int AND totals.previous_impressions >= ${minimumImpressions}::int
          AND totals.previous_clicks >= ${minimumPreviousClicks}::int
        THEN 100 * (totals.clicks - totals.previous_clicks) / NULLIF(totals.previous_clicks, 0) END AS "clickChangePercent"
      FROM mapped LEFT JOIN totals ON totals."urlId" = mapped."urlId"
    ), scored AS (
      SELECT ranked.*, array_remove(ARRAY[
        CASE WHEN NOT "seoNoIndex" AND sufficient AND ctr < ${maximumCtr}::double precision THEN 'low-ctr' END,
        CASE WHEN NOT "seoNoIndex" AND "clickChangePercent" <= -(${minimumChange}::double precision) THEN 'decline' END,
        CASE WHEN NOT "seoNoIndex" AND "clickChangePercent" >= ${minimumChange}::double precision THEN 'growth' END
      ]::text[], NULL) AS opportunities FROM ranked
    ), matching AS (
      SELECT * FROM scored ${opportunity}
    ), selected AS (
      SELECT * FROM matching ORDER BY ${order} LIMIT ${limit} OFFSET ${(page - 1) * limit}
    )
    SELECT (SELECT COUNT(*)::int FROM matching) AS total,
      COALESCE((SELECT jsonb_agg(to_jsonb(selected) - 'name' - 'seoNoIndex' ORDER BY ${order}) FROM selected), '[]'::jsonb) AS items
  `;
}

export function entityDaysQuery(window: ReportWindow, urlId: string | null) {
  return Prisma.sql`
    WITH ${latestSuccessfulRuns(window)}
    SELECT to_char(latest."metricDate", 'YYYY-MM-DD') AS date,
      data.clicks, data.impressions, data."averagePosition"
    FROM latest LEFT JOIN seo_performance_daily data ON data."syncRunId" = latest.id
      AND data.scope = 'PAGE' AND data."urlId" = ${urlId}::uuid
    ORDER BY latest."metricDate"
  `;
}

export type EntityBreakdown = {
  topQueries: SearchOverviewRowDto[];
  devices: SearchOverviewRowDto[];
  cappedQueryDays: number;
};

export function entityBreakdownQuery(window: ReportWindow, urlId: string) {
  return Prisma.sql`
    WITH ${latestSuccessfulRuns(window)}, detail AS (
      SELECT data.scope,
        CASE WHEN data.scope = 'PAGE_QUERY' THEN data."searchQuery" ELSE UPPER(data.device) END AS label,
        data.clicks, data.impressions, data."averagePosition"
      FROM latest JOIN seo_performance_daily data ON data."syncRunId" = latest.id
        AND data."urlId" = ${urlId}::uuid AND data.scope IN ('PAGE_QUERY', 'PAGE_DEVICE')
    ), groups AS (
      SELECT scope, label, SUM(clicks) AS clicks, SUM(impressions) AS impressions,
        SUM(clicks) / NULLIF(SUM(impressions), 0) AS ctr,
        CASE WHEN SUM(impressions) =
          COALESCE(SUM(impressions) FILTER (WHERE "averagePosition" IS NOT NULL), 0)
        THEN SUM("averagePosition" * impressions) / NULLIF(SUM(impressions), 0) END AS "averagePosition"
      FROM detail WHERE label IS NOT NULL GROUP BY scope, label
    ), top_queries AS (
      SELECT * FROM groups WHERE scope = 'PAGE_QUERY' ORDER BY clicks DESC, label COLLATE "C" LIMIT 25
    )
    SELECT COALESCE((SELECT jsonb_agg(to_jsonb(top_queries) - 'scope' ORDER BY clicks DESC, label COLLATE "C") FROM top_queries), '[]'::jsonb) AS "topQueries",
      COALESCE((SELECT jsonb_agg(to_jsonb(groups) - 'scope' ORDER BY clicks DESC, label COLLATE "C") FROM groups WHERE scope = 'PAGE_DEVICE'), '[]'::jsonb) AS devices,
      (SELECT COUNT(*)::int FROM latest WHERE (coverage -> 'PAGE_QUERY' ->> 'capped') = 'true') AS "cappedQueryDays"
  `;
}
