import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import {
  buildCatalogProductStockSql,
  buildCatalogStockCte,
} from '../../catalog/catalog-variant-filter';
import { auditPath, type AuditObservation } from '../audit/seo-audit-crawl';
import { hasAuditNoindex } from '../audit/seo-audit-rules';
import type { GoogleIndex } from '../inspection/seo-index-observation';
import type { SeoEntityKind } from '../dto/search-entity.dto';
import { SEO_CANONICAL_PATH_PATTERN } from '../seo-validation';
import {
  entitySourceQuery,
  seoEntitySources,
  type EntitySourceRow,
} from '../search-console/search-entity-query';
import { latestSuccessfulRuns } from '../search-console/search-overview-query';
import {
  opportunityWindowDays,
  type OpportunityMetrics,
  type OpportunitySubject,
} from './seo-opportunity-rules';

export type OpportunityScope = { property: string; origin: string };
type Window = { start: string; end: string };
export const opportunityDay = (date: Date) => date.toISOString().slice(0, 10);
export const shiftOpportunityDay = (day: string, offset: number) =>
  opportunityDay(new Date(Date.parse(day) + offset * 86_400_000));

type Totals = {
  observedDays: number;
  cappedDays: number;
  clicks: number | null;
  impressions: number | null;
  position: number | null;
};

type SubjectRow = {
  id: string;
  kind: SeoEntityKind;
  name: string;
  slug: string;
  canonical: string | null;
  urlId: string;
  url: string;
  metadata: string;
  currentDays: number;
  currentClicks: number | null;
  currentImpressions: number | null;
  currentPosition: number | null;
  previousDays: number;
  previousClicks: number | null;
  previousImpressions: number | null;
  previousPosition: number | null;
  currentCapped: number;
  previousCapped: number;
};

export function opportunityMetricWindow(window: Window, totals: Totals): OpportunityMetrics {
  const days = Math.round((Date.parse(window.end) - Date.parse(window.start)) / 86_400_000) + 1;
  const complete = totals.observedDays === days;
  return {
    ...window,
    days,
    observedDays: totals.observedDays,
    cappedDays: totals.cappedDays,
    clicks: complete ? totals.clicks : null,
    impressions: complete ? totals.impressions : null,
    ctr:
      complete && totals.impressions && totals.clicks !== null
        ? totals.clicks / totals.impressions
        : null,
    position: complete ? totals.position : null,
  };
}

const inventoryKeys = Object.keys(seoEntitySources) as SeoEntityKind[];
const weightedPosition = Prisma.sql`
  CASE WHEN SUM(impressions) = COALESCE(SUM(impressions) FILTER (WHERE position IS NOT NULL), 0)
    THEN SUM(position * impressions) / NULLIF(SUM(impressions), 0) END
`;

function canonicalOpportunityPath(
  scope: OpportunityScope,
  kind: SeoEntityKind,
  slug: string,
  override: string | null,
) {
  const prefix = seoEntitySources[kind].path;
  const configured = override?.trim();
  return auditPath(
    scope.origin,
    configured?.startsWith(prefix) && SEO_CANONICAL_PATH_PATTERN.test(configured)
      ? configured
      : prefix + slug,
  );
}

export async function isCurrentOpportunityUrl(
  db: PrismaService,
  scope: OpportunityScope,
  kind: string,
  entityId: string,
  url: string,
): Promise<boolean> {
  if (!Object.hasOwn(seoEntitySources, kind)) return false;
  const typed = kind as SeoEntityKind;
  const [entity] = await db.$queryRaw<EntitySourceRow[]>(
    entitySourceQuery(typed, { id: entityId }),
  );
  if (!entity || entity.seoNoIndex) return false;
  const path = canonicalOpportunityPath(scope, typed, entity.slug, entity.seoCanonicalPath);
  return path !== null && new URL(path, scope.origin).href === url;
}

export async function readOpportunitySubjects(
  db: PrismaService,
  scope: OpportunityScope,
  now: Date,
) {
  const integration = await db.seoIntegration.findUnique({
    where: { property: scope.property },
    select: { id: true },
  });
  if (!integration) return { subjects: [], canRefresh: false };
  const anchor = await db.seoSyncRun.findFirst({
    where: { integrationId: integration.id, searchType: 'web', status: 'SUCCEEDED' },
    select: { metricDate: true },
    orderBy: { metricDate: 'desc' },
  });
  if (!anchor || now.getTime() - anchor.metricDate.getTime() > 10 * 86_400_000)
    return { subjects: [], canRefresh: false };

  const end = opportunityDay(anchor.metricDate);
  const current = { start: shiftOpportunityDay(end, 1 - opportunityWindowDays), end };
  const previous = {
    start: shiftOpportunityDay(end, 1 - 2 * opportunityWindowDays),
    end: shiftOpportunityDay(current.start, -1),
  };
  const report = {
    integrationId: integration.id,
    searchType: 'web',
    startDate: previous.start,
    endDate: end,
  };
  const prefix = scope.origin + '/';
  const entities = inventoryKeys.map((kind) => {
    const { table, title, visible, column } = seoEntitySources[kind];
    return Prisma.sql`
      SELECT entity.id, ${kind}::text AS kind, ${title} AS name, entity.slug, entity."seoCanonicalPath" AS canonical,
        inventory.id AS "urlId", inventory."reportedUrl" AS url,
        CONCAT_WS(' ', ${title}, entity."seoTitle", entity."seoDescription") AS metadata
      FROM candidates JOIN seo_url_inventory inventory ON inventory.id = candidates."urlId"
      JOIN ${table} entity ON entity.id = ${column}
      WHERE entity."deletedAt" IS NULL AND ${visible} AND NOT entity."seoNoIndex"
    `;
  });
  const rows = await db.$queryRaw<SubjectRow[]>(Prisma.sql`
    WITH ${latestSuccessfulRuns(report)}, pages AS MATERIALIZED (
      SELECT data."urlId", data.clicks, data.impressions, data."averagePosition" AS position,
        latest."metricDate", latest."metricDate" >= ${current.start}::date AS recent
      FROM latest JOIN seo_performance_daily data ON data."syncRunId" = latest.id
      JOIN seo_url_inventory inventory ON inventory.id = data."urlId"
      WHERE data.scope = 'PAGE' AND data.aggregation = 'byPage'
        AND inventory."reportedSearch" IS NULL AND left(inventory."reportedUrl", length(${prefix})) = ${prefix}
    ), candidates AS MATERIALIZED (
      SELECT "urlId" FROM pages WHERE recent GROUP BY "urlId" HAVING SUM(impressions) >= 200
      ORDER BY SUM(impressions) DESC, "urlId" LIMIT 200
    ), entities AS (${Prisma.join(entities, ' UNION ALL ')}), totals AS (
      SELECT "urlId", recent, COUNT(DISTINCT "metricDate")::int AS days, SUM(clicks) AS clicks,
        SUM(impressions) AS impressions, ${weightedPosition} AS position
      FROM pages JOIN candidates USING ("urlId") GROUP BY "urlId", recent
    ), coverage AS (
      SELECT COUNT(*) FILTER (WHERE "metricDate" >= ${current.start}::date)::int AS current_days,
        COUNT(*) FILTER (WHERE "metricDate" >= ${current.start}::date AND coverage #>> '{PAGE,capped}' = 'true')::int AS current_capped,
        COUNT(*) FILTER (WHERE "metricDate" < ${current.start}::date AND coverage #>> '{PAGE,capped}' = 'true')::int AS previous_capped
      FROM latest
    )
    SELECT entities.*, recent_totals.days AS "currentDays", recent_totals.clicks AS "currentClicks",
      recent_totals.impressions AS "currentImpressions", recent_totals.position AS "currentPosition",
      COALESCE(prior_totals.days, 0) AS "previousDays", prior_totals.clicks AS "previousClicks",
      prior_totals.impressions AS "previousImpressions", prior_totals.position AS "previousPosition",
      coverage.current_capped AS "currentCapped", coverage.previous_capped AS "previousCapped"
    FROM entities JOIN totals recent_totals ON recent_totals."urlId" = entities."urlId" AND recent_totals.recent
    CROSS JOIN coverage
    LEFT JOIN totals prior_totals ON prior_totals."urlId" = entities."urlId" AND NOT prior_totals.recent
    WHERE recent_totals.days = ${opportunityWindowDays} AND coverage.current_days = ${opportunityWindowDays}
    ORDER BY recent_totals.impressions DESC, entities.kind, entities.id, entities.url
  `);
  const canonical = rows.flatMap((row) => {
    const path = canonicalOpportunityPath(scope, row.kind, row.slug, row.canonical);
    return path && new URL(path, scope.origin).href === row.url ? [{ row, path }] : [];
  });
  if (!canonical.length) return { subjects: [], canRefresh: true };
  const paths = canonical.map(({ path }) => path);
  const queries = canonical.map(({ row }) => Prisma.sql`${row.urlId}::uuid`);
  const categoryIds = canonical.flatMap(({ row }) => (row.kind === 'category' ? [row.id] : []));
  const productIds = canonical.flatMap(({ row }) => (row.kind === 'product' ? [row.id] : []));
  const [audit, issues, indexed, queriesByPage, stocks, articles] = await Promise.all([
    db.$queryRaw<{ path: string; checkedAt: Date; observation: Prisma.JsonValue }[]>(Prisma.sql`
      SELECT DISTINCT ON (c.path) c.path, c."checkedAt", c.observation
      FROM seo_audit_checks c JOIN seo_audit_runs r ON r.id = c."runId"
      WHERE r.origin = ${scope.origin} AND r."finishedAt" IS NOT NULL AND c."checkedAt" IS NOT NULL
        AND c.path IN (${Prisma.join(paths)})
      ORDER BY c.path, c."checkedAt" DESC, c."runId" DESC
    `),
    db.seoIssue.findMany({
      where: {
        ...scope,
        active: true,
        severity: 'CRITICAL',
        subject: { in: [...paths, ...canonical.map(({ row }) => row.url)] },
      },
      select: { subject: true, rule: true },
    }),
    db.seoInspectionTarget.findMany({
      where: {
        ...scope,
        path: { in: paths },
        observedAt: { gte: new Date(now.getTime() - 30 * 86_400_000) },
      },
      select: { path: true, observation: true },
    }),
    db.$queryRaw<{ urlId: string; label: string; impressions: number }[]>(Prisma.sql`
      WITH ${latestSuccessfulRuns({ ...report, startDate: current.start })}, groups AS (
        SELECT data."urlId", data."searchQuery" AS label, SUM(data.impressions) AS impressions
        FROM latest JOIN seo_performance_daily data ON data."syncRunId" = latest.id
        WHERE data.scope = 'PAGE_QUERY' AND data."searchQuery" IS NOT NULL AND data."urlId" IN (${Prisma.join(queries)})
        GROUP BY data."urlId", data."searchQuery"
        HAVING SUM(data.impressions) >= 50 AND COUNT(DISTINCT latest."metricDate") >= 3
      )
      SELECT DISTINCT ON ("urlId") "urlId", label, impressions FROM groups
      ORDER BY "urlId", impressions DESC, label COLLATE "C"
    `),
    readOpportunityStock(db, productIds, categoryIds),
    readRelatedGuideArticles(db, categoryIds),
  ]);

  const auditByPath = new Map(audit.map((check) => [check.path, check]));
  const blocked = new Set(
    issues
      .filter(({ rule }) => rule.startsWith('TECH_') || rule === 'NOINDEX_CHANGED')
      .map(({ subject }) => subject),
  );
  const indexMap = new Map(
    indexed.map(({ path, observation }) => [path, observation as GoogleIndex | null]),
  );
  const queryMap = new Map(queriesByPage.map((row) => [row.urlId, row]));
  const articleMap = new Map(
    articles.map(({ categoryId, slug, title }) => [categoryId, { title, path: '/guide/' + slug }]),
  );
  return {
    canRefresh: true,
    subjects: canonical.map(({ row, path }): OpportunitySubject => {
      const observation = auditByPath.get(path);
      const observed = observation?.observation as AuditObservation | null | undefined;
      const freshAudit =
        observation && now.getTime() - observation.checkedAt.getTime() <= 30 * 86_400_000;
      const verified = Boolean(
        freshAudit && observed?.html && !observed.failure && observed.status === 200,
      );
      const google = indexMap.get(path);
      const canonicalMismatch =
        observed?.canonicals.length === 1 &&
        auditPath(scope.origin, observed.canonicals[0]) !== path;
      return {
        entityKind: row.kind,
        entityId: row.id,
        title: row.name,
        url: row.url,
        metadata: row.metadata,
        blocked:
          blocked.has(path) ||
          blocked.has(row.url) ||
          Boolean(
            freshAudit &&
            observed &&
            !observed.failure &&
            ([404, 410].includes(observed.status ?? 0) ||
              observed.redirects.length ||
              (verified && (hasAuditNoindex(observed.robots) || canonicalMismatch))),
          ) ||
          ['BLOCKED_BY_META_TAG', 'BLOCKED_BY_HTTP_HEADER'].includes(google?.indexingState ?? ''),
        auditVerified: verified,
        googleReview: ['FAIL', 'NEUTRAL'].includes(google?.verdict ?? ''),
        current: opportunityMetricWindow(current, {
          observedDays: row.currentDays,
          cappedDays: row.currentCapped,
          clicks: row.currentClicks,
          impressions: row.currentImpressions,
          position: row.currentPosition,
        }),
        previous: opportunityMetricWindow(previous, {
          observedDays: row.previousDays,
          cappedDays: row.previousCapped,
          clicks: row.previousClicks,
          impressions: row.previousImpressions,
          position: row.previousPosition,
        }),
        stock: stocks.get(row.id) ?? 'NOT_OBSERVED',
        query: queryMap.get(row.urlId) ?? null,
        relatedArticle: row.kind === 'category' ? (articleMap.get(row.id) ?? null) : null,
      };
    }),
  };
}

async function readOpportunityStock(db: PrismaService, products: string[], categories: string[]) {
  const stock = new Map<string, OpportunitySubject['stock']>();
  if (!products.length && !categories.length) return stock;
  const rows = await db.$queryRaw<{ id: string; available: boolean; source: string }[]>(Prisma.sql`
    WITH product_ids AS (SELECT id FROM unnest(ARRAY[${Prisma.join(products.length ? products : [null])}]::uuid[]) AS input(id) WHERE id IS NOT NULL),
    category_samples AS MATERIALIZED (
      SELECT c.id AS "categoryId", sample.id AS "productId"
      FROM unnest(ARRAY[${Prisma.join(categories.length ? categories : [null])}]::uuid[]) AS c(id)
      CROSS JOIN LATERAL (
        SELECT p.id FROM product_categories pc JOIN products p ON p.id = pc."productId"
        WHERE pc."categoryId" = c.id AND p.status = 'ACTIVE' AND p."deletedAt" IS NULL
        ORDER BY pc."productId" LIMIT 8
      ) sample
    ), targets AS (
      SELECT id FROM product_ids UNION SELECT "productId" AS id FROM category_samples
    ), variants AS (
      SELECT v.id FROM product_variants v JOIN targets t ON t.id = v."productId"
      UNION
      SELECT b."componentVariantId" FROM product_variant_components b
      JOIN product_variants v ON v.id = b."bundleVariantId" JOIN targets t ON t.id = v."productId"
    ), ${buildCatalogStockCte(true, Prisma.sql`SELECT id FROM variants`)},
    availability AS MATERIALIZED (
      SELECT product.id, ${buildCatalogProductStockSql(true)} > 0 AS available
      FROM products product JOIN targets ON targets.id = product.id
    )
    SELECT id, available, 'product' AS source FROM availability JOIN product_ids USING (id)
    UNION ALL SELECT "categoryId", bool_or(available), 'category'
    FROM category_samples JOIN availability ON availability.id = category_samples."productId"
    GROUP BY "categoryId"
  `);
  for (const row of rows)
    stock.set(
      row.id,
      row.available ? 'AVAILABLE' : row.source === 'product' ? 'OUT_OF_STOCK' : 'NOT_OBSERVED',
    );
  return stock;
}

async function readRelatedGuideArticles(db: PrismaService, categories: string[]) {
  if (!categories.length) return [];
  return db.$queryRaw<{ categoryId: string; slug: string; title: string }[]>(Prisma.sql`
    SELECT c.id AS "categoryId", article.slug, article.title
    FROM unnest(ARRAY[${Prisma.join(categories)}]::uuid[]) AS c(id)
    CROSS JOIN LATERAL (
      SELECT a.slug, a.title
      FROM guide_articles a JOIN guide_article_products reference ON reference."articleId" = a.id
      JOIN product_categories pc ON pc."productId" = reference."productId" AND pc."categoryId" = c.id
      JOIN products p ON p.id = pc."productId" AND p.status = 'ACTIVE' AND p."deletedAt" IS NULL
      WHERE a.status = 'PUBLISHED' AND a."deletedAt" IS NULL AND a."publishedAt" <= CURRENT_TIMESTAMP AND NOT a."seoNoIndex"
        AND NOT EXISTS (
          SELECT 1 FROM guide_article_categories g JOIN guide_articles present ON present.id = g."articleId"
          WHERE g."categoryId" = c.id AND present.status = 'PUBLISHED' AND present."deletedAt" IS NULL
            AND present."publishedAt" <= CURRENT_TIMESTAMP AND NOT present."seoNoIndex"
        )
      ORDER BY a."publishedAt" DESC, a.id LIMIT 1
    ) article
  `);
}
