import type { Prisma } from '../../../generated/prisma/client';
import { GuideArticleStatus, ProductStatus } from '../../../generated/prisma/enums';
import { SearchConsoleError } from './search-console-errors';
import { sha256 } from './search-console-sync-data';

const routes = {
  products: 'PRODUCT',
  categories: 'CATEGORY',
  brands: 'BRAND',
  guide: 'GUIDE_ARTICLE',
} as const;
type Route = keyof typeof routes;
type EntityKind = (typeof routes)[Route];
type Entity = { id: string; slug: string; seoCanonicalPath: string | null };

export function parseReportedUrl(reportedUrl: string) {
  let url: URL;
  try {
    url = new URL(reportedUrl);
  } catch {
    throw new SearchConsoleError('invalid_response');
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new SearchConsoleError('invalid_response');
  }
  const normalizedPath = url.pathname.replace(/\/+$/, '') || '/';
  const fields = {
    urlKey: sha256(reportedUrl),
    reportedUrl,
    reportedPath: url.pathname,
    reportedSearch: url.search || null,
    normalizedPath,
  };
  const route = /^\/(products|categories|brands|guide)\/([^/]+)$/.exec(normalizedPath);
  if (!route || url.port || !['hamidian.shop', 'www.hamidian.shop'].includes(url.hostname)) {
    return { ...fields, candidate: null };
  }
  let slug: string;
  try {
    slug = decodeURIComponent(route[2]);
  } catch {
    return { ...fields, candidate: null };
  }
  if (
    slug.length > 220 ||
    /[\\/?#]/.test(slug) ||
    slug.includes('\0') ||
    slug === '.' ||
    slug === '..'
  ) {
    return { ...fields, candidate: null };
  }
  const prefix = route[1] as Route;
  return {
    ...fields,
    candidate: { prefix, kind: routes[prefix], slug, path: `/${prefix}/${slug}` },
  };
}

export async function saveReportedUrls(
  tx: Prisma.TransactionClient,
  integrationId: string,
  reportedUrls: Iterable<string>,
) {
  const urls = [...new Set(reportedUrls)].map(parseReportedUrl);
  if (!urls.length) return new Map<string, string>();
  const candidates = urls.flatMap(({ candidate }) => (candidate ? [candidate] : []));
  const redirects = await tx.seoRedirect.findMany({
    where: { sourcePath: { in: [...new Set(candidates.map(({ path }) => path))] } },
    select: { sourcePath: true, entityType: true, entityId: true },
  });
  const redirectByPath = new Map(redirects.map((redirect) => [redirect.sourcePath, redirect]));
  const criteria = (kind: EntityKind) => [
    {
      slug: {
        in: [...new Set(candidates.filter((item) => item.kind === kind).map(({ slug }) => slug))],
      },
    },
    {
      id: {
        in: [
          ...new Set(
            redirects
              .filter(({ entityType }) => entityType === kind)
              .map(({ entityId }) => entityId),
          ),
        ],
      },
    },
  ];
  const select = { id: true, slug: true, seoCanonicalPath: true } as const;
  const [products, categories, brands, articles] = await Promise.all([
    tx.product.findMany({
      where: { deletedAt: null, status: ProductStatus.ACTIVE, OR: criteria('PRODUCT') },
      select,
    }),
    tx.category.findMany({
      where: { deletedAt: null, isActive: true, OR: criteria('CATEGORY') },
      select,
    }),
    tx.brand.findMany({
      where: { deletedAt: null, isActive: true, OR: criteria('BRAND') },
      select,
    }),
    tx.guideArticle.findMany({
      where: {
        deletedAt: null,
        status: GuideArticleStatus.PUBLISHED,
        publishedAt: { lte: new Date() },
        OR: criteria('GUIDE_ARTICLE'),
      },
      select,
    }),
  ]);
  const entityMaps = (entities: Entity[]) => ({
    bySlug: new Map(entities.map((entity) => [entity.slug, entity])),
    byId: new Map(entities.map((entity) => [entity.id, entity])),
  });
  const lookup = {
    PRODUCT: entityMaps(products),
    CATEGORY: entityMaps(categories),
    BRAND: entityMaps(brands),
    GUIDE_ARTICLE: entityMaps(articles),
  };
  const entries = urls.map(({ candidate, ...url }) => {
    const redirect = candidate ? redirectByPath.get(candidate.path) : null;
    const kind = candidate?.kind;
    const direct = candidate ? lookup[candidate.kind].bySlug.get(candidate.slug) : undefined;
    const entity =
      direct ??
      (redirect && kind === redirect.entityType
        ? lookup[kind].byId.get(redirect.entityId)
        : undefined);
    return {
      ...url,
      canonicalPath: entity
        ? entity.seoCanonicalPath || `/${candidate?.prefix}/${entity.slug}`
        : null,
      matchedBy: entity ? (direct ? 'direct' : 'redirect') : null,
      productId: kind === 'PRODUCT' ? (entity?.id ?? null) : null,
      categoryId: kind === 'CATEGORY' ? (entity?.id ?? null) : null,
      brandId: kind === 'BRAND' ? (entity?.id ?? null) : null,
      articleId: kind === 'GUIDE_ARTICLE' ? (entity?.id ?? null) : null,
    };
  });
  const saved = await tx.$queryRaw<{ id: string; urlKey: string }[]>`
    INSERT INTO "seo_url_inventory" (
      "integrationId", "urlKey", "reportedUrl", "reportedPath", "reportedSearch",
      "normalizedPath", "canonicalPath", "matchedBy", "productId", "categoryId", "brandId", "articleId"
    )
    SELECT ${integrationId}::uuid, incoming.*
    FROM jsonb_to_recordset(${JSON.stringify(entries)}::jsonb) AS incoming(
      "urlKey" text, "reportedUrl" text, "reportedPath" text, "reportedSearch" text,
      "normalizedPath" text, "canonicalPath" text, "matchedBy" text, "productId" uuid,
      "categoryId" uuid, "brandId" uuid, "articleId" uuid
    )
    ON CONFLICT ("integrationId", "urlKey") DO UPDATE SET
      "canonicalPath" = EXCLUDED."canonicalPath", "matchedBy" = EXCLUDED."matchedBy",
      "productId" = EXCLUDED."productId", "categoryId" = EXCLUDED."categoryId",
      "brandId" = EXCLUDED."brandId", "articleId" = EXCLUDED."articleId",
      "lastObservedAt" = clock_timestamp()
    RETURNING "id", "urlKey"
  `;
  return new Map(saved.map(({ id, urlKey }) => [urlKey, id]));
}
