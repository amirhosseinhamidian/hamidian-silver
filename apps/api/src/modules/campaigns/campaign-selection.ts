import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { normalizeCatalogSearch } from '../catalog/catalog-search';
import {
  catalogCategorySubtreeCte,
  readActiveCategoryProductCounts,
} from '../catalog/catalog-category-counts';
import {
  buildCatalogProductStockSql,
  buildCatalogStockCte,
} from '../catalog/catalog-variant-filter';
import type { PublicMediaUrlService } from '../catalog/public-media-url.service';
import {
  committedCampaignIncentives,
  discountBudget,
  promotionUsage,
} from '../promotions/promotion-budget';
import { selectCatalogPromotion } from '../promotions/promotion-presentation';
import { quotaCounts, quotaUsage } from './campaign-quota';
import type {
  CampaignProductOptionsDto,
  CampaignProductQueryDto,
  CampaignTaxonomyOptionsDto,
} from './dto/campaign-operations.dto';

const pageSize = 12;
const checkoutStock = buildCatalogProductStockSql(true);
const idArray = (ids: readonly string[]) =>
  ids.length ? Prisma.sql`ARRAY[${Prisma.join(ids)}]::uuid[]` : Prisma.sql`ARRAY[]::uuid[]`;

export async function selectCampaignProducts(
  tx: Prisma.TransactionClient,
  mediaUrls: PublicMediaUrlService,
  query: CampaignProductQueryDto,
): Promise<CampaignProductOptionsDto> {
  const { q, category, brand, stock, categoryMode = 'tree', campaignId, selected } = query;
  const page = query.page ?? 1;
  if (query.scope === 'campaign' && !campaignId) {
    throw new BadRequestException('Campaign scope requires a campaign identifier.');
  }
  if ([q, category, brand, ...(selected ?? [])].some((part) => part?.includes('\0'))) {
    throw new BadRequestException('Invalid product search.');
  }
  const campaign = campaignId
    ? await tx.campaign.findUnique({ where: { id: campaignId }, include: { promotion: true } })
    : null;
  if (campaignId && !campaign) throw new NotFoundException('Campaign not found.');
  const requested = selected && [...new Set(selected)];
  if (requested?.length === 0) return { items: [], page: 1, hasMore: false };
  const scope =
    query.scope === 'campaign' && campaign && !campaign.allProducts
      ? Prisma.sql`AND (product.id = ANY(${idArray(campaign.productIds)}) OR EXISTS (
        SELECT 1 FROM "product_categories" membership
        JOIN "categories" scope_category ON scope_category.id = membership."categoryId"
        WHERE membership."productId" = product.id
          AND membership."categoryId" = ANY(${idArray(campaign.categoryIds)})
          AND scope_category."isActive" AND scope_category."deletedAt" IS NULL
      ))`
      : Prisma.empty;
  const subtree = !requested && category && categoryMode === 'tree';
  const matchesCategory = category
    ? Prisma.sql`AND EXISTS (
    SELECT 1 FROM "product_categories" membership
    ${subtree ? Prisma.sql`JOIN subtree relation ON relation."categoryId" = membership."categoryId"` : Prisma.empty}
    JOIN "categories" root ON root.id = ${subtree ? Prisma.sql`relation."rootId"` : Prisma.sql`membership."categoryId"`}
    WHERE membership."productId" = product.id AND root.slug = ${category}
      AND root."isActive" AND root."deletedAt" IS NULL
  )`
    : Prisma.empty;
  const term = q?.trim() || null;
  const normalized = term && (normalizeCatalogSearch(term) || term);
  const pattern = normalized && `%${normalized.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
  const exactId =
    term && /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(term)
      ? Prisma.sql`OR product.id = ${term}::uuid`
      : Prisma.empty;
  const filterByStock = !requested && Boolean(stock);
  const where = requested
    ? Prisma.sql`AND product.slug IN (${Prisma.join(requested)})`
    : Prisma.sql`
        ${scope} ${matchesCategory}
        ${brand ? Prisma.sql`AND EXISTS (SELECT 1 FROM "brands" b WHERE b.id = product."brandId" AND b.slug = ${brand} AND b."isActive" AND b."deletedAt" IS NULL)` : Prisma.empty}
        ${
          pattern
            ? Prisma.sql`AND (
          normalize_fa_search(product.name) LIKE ${pattern} OR
          normalize_fa_search(product.slug) LIKE ${pattern} ${exactId} OR EXISTS (
            SELECT 1 FROM "product_variants" sku_variant WHERE sku_variant."productId" = product.id
              AND sku_variant."deletedAt" IS NULL AND normalize_fa_search(sku_variant.sku) LIKE ${pattern}
          )
        )`
            : Prisma.empty
        }
      `;
  const pageWindow = Prisma.sql`LIMIT ${pageSize + 1} OFFSET ${(page - 1) * pageSize}`;
  const variantIds = Prisma.sql`
    SELECT variant.id FROM "product_variants" variant JOIN candidates ON candidates.id = variant."productId"
    UNION
    SELECT recipe."componentVariantId" FROM "product_variant_components" recipe
    JOIN "product_variants" variant ON variant.id = recipe."bundleVariantId"
    JOIN candidates ON candidates.id = variant."productId"
  `;
  const matches = await tx.$queryRaw<Array<{ id: string; stock: bigint }>>`
    WITH RECURSIVE ${subtree ? Prisma.sql`${catalogCategorySubtreeCte},` : Prisma.empty}
    candidates AS MATERIALIZED (
      SELECT product.id FROM "products" product
      WHERE product.status = 'ACTIVE' AND product."deletedAt" IS NULL ${where}
      ${requested || filterByStock ? Prisma.empty : Prisma.sql`ORDER BY product.name, product.id ${pageWindow}`}
    ), ${buildCatalogStockCte(true, variantIds)}
    SELECT product.id, available.units AS stock
    FROM candidates JOIN "products" product ON product.id = candidates.id
    CROSS JOIN LATERAL (SELECT ${checkoutStock} AS units) AS available
    ${filterByStock ? Prisma.sql`WHERE available.units ${stock === 'in-stock' ? Prisma.sql`> 0` : Prisma.sql`= 0`}` : Prisma.empty}
    ORDER BY product.name, product.id
    ${filterByStock ? pageWindow : Prisma.empty}
  `;
  const shown = requested ? matches : matches.slice(0, pageSize);
  if (shown.length === 0) return { items: [], page, hasMore: false };
  const ids = shown.map(({ id }) => id);
  const [products, quotas, usage] = await Promise.all([
    tx.product.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        slug: true,
        name: true,
        salePriceToman: true,
        categories: {
          where: { category: { isActive: true, deletedAt: null } },
          select: { categoryId: true, category: { select: { name: true } } },
          orderBy: { category: { name: 'asc' } },
        },
        media: {
          where: { media: { deletedAt: null, mimeType: { startsWith: 'image/' } } },
          orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }, { mediaId: 'asc' }],
          take: 1,
          select: { altText: true, media: { select: { altText: true, storageKey: true } } },
        },
      },
    }),
    campaign
      ? tx.campaignQuota.findMany({ where: { campaignId: campaign.id, productId: { in: ids } } })
      : [],
    campaign?.promotion ? promotionUsage(tx, campaign.id) : null,
  ]);
  const candidates =
    campaign?.promotion &&
    (campaign.promotion.maxUses === null || (usage?._count._all ?? 0) < campaign.promotion.maxUses)
      ? [
          {
            ...campaign.promotion,
            campaign,
            remainingToman:
              discountBudget(campaign) - (usage ? committedCampaignIncentives(usage) : 0),
          },
        ]
      : [];
  const quotaUsageById = await quotaUsage(
    tx,
    quotas.map(({ id }) => id),
  );
  const quotaByProduct = new Map(
    quotas.map((quota) => [quota.productId, quotaCounts(quota, quotaUsageById).remaining]),
  );
  const productsById = new Map(products.map((product) => [product.id, product]));
  return {
    page: requested ? 1 : page,
    hasMore: !requested && matches.length > pageSize,
    items: shown.flatMap(({ id, stock: available }) => {
      const product = productsById.get(id);
      if (!product) return [];
      const image = product.media[0];
      const remaining = quotaByProduct.get(id);
      const offer =
        remaining === 0
          ? null
          : selectCatalogPromotion(
              candidates,
              {
                productId: id,
                categoryIds: product.categories.map(({ categoryId }) => categoryId),
              },
              product.salePriceToman,
            );
      return [
        {
          id,
          slug: product.slug,
          name: product.name,
          availableQuantity: Number(available),
          defaultPriceToman: product.salePriceToman,
          festivalPriceToman: offer?.price?.finalToman ?? null,
          quotaRemaining: remaining ?? null,
          categories: product.categories.map(({ category }) => category.name),
          imageUrl: image ? mediaUrls.resolve(image.media.storageKey) : null,
          imageAlt: image?.altText ?? image?.media.altText ?? null,
        },
      ];
    }),
  };
}

export async function campaignTaxonomy(
  tx: Prisma.TransactionClient,
): Promise<CampaignTaxonomyOptionsDto> {
  const [categories, brands, counts] = await Promise.all([
    tx.category.findMany({
      where: { isActive: true, deletedAt: null },
      select: { id: true, name: true, slug: true, parentId: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }, { id: 'asc' }],
    }),
    tx.brand.findMany({
      where: { isActive: true, deletedAt: null },
      select: { id: true, name: true, slug: true },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    }),
    readActiveCategoryProductCounts(tx),
  ]);
  return {
    brands,
    categories: categories.map((category) => ({
      ...category,
      directProductCount: counts.get(category.id)?.activeProductCount ?? 0,
      subtreeProductCount: counts.get(category.id)?.activeSubtreeProductCount ?? 0,
    })),
  };
}
