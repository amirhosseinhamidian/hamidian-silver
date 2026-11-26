import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import {
  buildCatalogProductStockSql,
  buildCatalogStockCte,
} from '../../catalog/catalog-variant-filter';
import { AUDIT_LEGACY_REDIRECTS, auditPath } from './seo-audit-crawl';

export type AuditSeed = {
  path: string;
  priority: number;
  source: string;
  sourcePath?: string;
  expectedCanonical?: string;
  productId?: string;
};

export const AUDIT_MAX_TARGETS = 40;

export async function readAuditInventory(db: PrismaService, origin: string, now: Date) {
  const orderBy = [{ updatedAt: 'desc' }, { id: 'asc' }] as const;
  const select = { slug: true, seoCanonicalPath: true } as const;
  const [products, categories, brands, articles, campaigns] = await Promise.all([
    db.product.findMany({
      where: { status: 'ACTIVE', deletedAt: null },
      orderBy: [...orderBy],
      take: 10,
      select: { ...select, id: true },
    }),
    db.category.findMany({
      where: { isActive: true, deletedAt: null },
      orderBy: [...orderBy],
      take: 3,
      select,
    }),
    db.brand.findMany({
      where: { isActive: true, deletedAt: null },
      orderBy: [...orderBy],
      take: 2,
      select,
    }),
    db.guideArticle.findMany({
      where: { status: 'PUBLISHED', deletedAt: null, publishedAt: { lte: now } },
      orderBy: [...orderBy],
      take: 2,
      select,
    }),
    db.campaignLanding.findMany({
      where: { campaign: { status: 'ACTIVE', startsAt: { lte: now }, endsAt: { gt: now } } },
      orderBy: [{ campaign: { startsAt: 'desc' } }, { campaignId: 'asc' }],
      take: 2,
      select: { slug: true, campaign: { select: { kind: true } } },
    }),
  ]);
  const targets = new Map<string, AuditSeed>();
  const add = (
    href: string,
    source: string,
    priority: number,
    canonical = href,
    productId?: string,
  ) => {
    const path = auditPath(origin, href, origin, source === 'SITEMAP_FILE');
    if (path && !targets.has(path)) {
      targets.set(path, { path, priority, source, expectedCanonical: canonical, productId });
    }
  };
  add('/sitemap.xml', 'SITEMAP_FILE', 0);
  for (const [index, path] of ['/', '/products', '/categories', '/brands', '/guide'].entries()) {
    add(path, 'HUB', 1 + index);
  }
  for (const row of products) {
    const path = `/products/${row.slug}`;
    add(path, 'PRODUCT', 10, row.seoCanonicalPath ?? path, row.id);
  }
  for (const [kind, rows] of [
    ['categories', categories],
    ['brands', brands],
    ['guide', articles],
  ] as const) {
    for (const row of rows) {
      const path = `/${kind}/${row.slug}`;
      add(path, 'PUBLISHED', 12, row.seoCanonicalPath ?? path);
    }
  }
  for (const row of campaigns) {
    const path = `/campaigns/${row.slug}`;
    add(path, row.campaign.kind === 'FESTIVAL' ? 'FESTIVAL' : 'CAMPAIGN', 6);
  }
  for (const [legacy, target] of AUDIT_LEGACY_REDIRECTS) {
    add(legacy, 'KNOWN_REDIRECT', 7, target);
  }
  add('/products?sort=price-asc', 'CATALOG_VARIANT', 8, '/products');
  return [...targets.values()];
}

export async function readAuditedProductStock(db: PrismaService, productId: string) {
  const [result] = await db.$queryRaw<{ available: boolean }[]>(Prisma.sql`
    WITH target AS (
      SELECT id, "purchaseMode", "sizeMode"
      FROM "products"
      WHERE id = ${productId}::uuid AND status = 'ACTIVE' AND "deletedAt" IS NULL
    ), variant_ids AS (
      SELECT v.id FROM "product_variants" AS v JOIN target ON target.id = v."productId"
      UNION
      SELECT recipe."componentVariantId"
      FROM "product_variant_components" AS recipe
      JOIN "product_variants" AS v ON v.id = recipe."bundleVariantId"
      JOIN target ON target.id = v."productId"
    ), ${buildCatalogStockCte(true, Prisma.sql`SELECT id FROM variant_ids`)}
    SELECT ${buildCatalogProductStockSql(true)} > 0 AS available FROM target AS product
  `);
  return result?.available ?? null;
}
