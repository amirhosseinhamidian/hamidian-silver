import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma, type Campaign, type CampaignLanding } from '../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { buildCatalogStockCte, catalogProductStockSql } from '../catalog/catalog-variant-filter';
import { CatalogService } from '../catalog/catalog.service';
import { PublicMediaUrlService } from '../catalog/public-media-url.service';
import { confirmedCampaignDiscountSums } from '../growth-attribution/growth-campaign-performance-query';
import { confirmedGrowthOrders } from '../growth-attribution/growth-revenue-events';
import { readCampaignProducts } from './campaign-collection';
import { scopedCampaignOrders } from './campaign-order-scope';
import { CampaignLandingsService } from './campaign-landings.service';
import { campaignQuotaTotals, quotaCounts, quotaStock, quotaUsage } from './campaign-quota';
import type {
  CampaignOperationsCenterDto,
  CampaignOperationsQueryDto,
  CampaignOrderCountsDto,
  CampaignOrderOperationDto,
} from './dto/campaign-operations-center.dto';

const pageSize = 25;
const variantPreviewSize = 5;
type OrderRow = Omit<CampaignOrderOperationDto, 'createdAt'> & { createdAt: Date };
type CountRow = { [Key in keyof CampaignOrderCountsDto]: bigint };

function asInteger(value: bigint) {
  const result = Number(value);
  if (!Number.isSafeInteger(result))
    throw new ServiceUnavailableException('Campaign metrics exceed the supported range.');
  return result;
}

@Injectable()
export class CampaignOperationsCenterService {
  constructor(
    private readonly db: PrismaService,
    private readonly catalog: CatalogService,
    private readonly landings: CampaignLandingsService,
    private readonly mediaUrls: PublicMediaUrlService,
  ) {}

  async read(
    campaignId: string,
    query: CampaignOperationsQueryDto,
    includeFinance: boolean,
    now = new Date(),
  ): Promise<CampaignOperationsCenterDto> {
    return this.db.$transaction(
      async (tx) => {
        const campaign = await tx.campaign.findUnique({
          where: { id: campaignId },
          include: { landing: true, promotion: { select: { campaignId: true } } },
        });
        if (!campaign) throw new NotFoundException('Campaign not found.');

        const orderPage = query.orderPage ?? 1;
        const quotaPage = query.quotaPage ?? 1;
        const orders = await this.orders(tx, campaign, orderPage, query, now);
        const quotas = await this.readQuotas(tx, campaignId, quotaPage);
        const finance = includeFinance ? await this.finance(tx, campaignId) : null;
        const landing = campaign.managementPurpose === 'SALES' ? null : campaign.landing;
        const status =
          campaign.kind === 'FESTIVAL'
            ? await this.festivalStatus(tx, campaign, landing, now)
            : {
                publication: await this.publication(tx, campaign, landing, now),
                festival: null,
              };

        return {
          ...orders,
          ...quotas,
          orderPage,
          quotaPage,
          finance,
          salesRuleConfigured: campaign.promotion !== null,
          ...status,
          landingSlug: landing?.slug ?? null,
          checkedAt: now.toISOString(),
        };
      },
      { isolationLevel: 'RepeatableRead', timeout: 10_000 },
    );
  }

  private async orders(
    tx: Prisma.TransactionClient,
    campaign: Campaign,
    page: number,
    { orderState: state, orderSort }: CampaignOperationsQueryDto,
    now: Date,
  ) {
    const scope = scopedCampaignOrders(campaign);
    const sort = orderSort === 'oldest' ? Prisma.sql`ASC` : Prisma.sql`DESC`;
    const overdue = Prisma.sql`"waitingForPayment" AND "reservationExpiresAt" <= ${now}`;
    const [counts] = await tx.$queryRaw<CountRow[]>`
        ${scope}
        SELECT COUNT(*) AS registered,
          COUNT(*) FILTER (WHERE confirmed) AS confirmed,
          COUNT(*) FILTER (WHERE state = 'RECEIPT_REVIEW') AS "awaitingReceipt",
          COUNT(*) FILTER (WHERE state = 'RECEIPT_REJECTED') AS "rejectedReceipt",
          COUNT(*) FILTER (WHERE state = 'PENDING') AS pending,
          COUNT(*) FILTER (WHERE state = 'PAYMENT_FAILED') AS "paymentFailed",
          COUNT(*) FILTER (WHERE state = 'RECONCILIATION') AS reconciliation,
          COUNT(*) FILTER (WHERE state = 'CANCELLED') AS cancelled,
          COUNT(*) FILTER (WHERE state = 'EXPIRED') AS expired,
          COUNT(*) FILTER (WHERE ${overdue}) AS "overdueReservations"
        FROM classified
      `;
    const rows = await tx.$queryRaw<OrderRow[]>`
        ${scope}
        SELECT id, number, "createdAt", state, "discountApplied" FROM classified
        ${
          state === 'CONFIRMED'
            ? Prisma.sql`WHERE confirmed`
            : state === 'OVERDUE_RESERVATION'
              ? Prisma.sql`WHERE ${overdue}`
              : state
                ? Prisma.sql`WHERE state = ${state}`
                : Prisma.empty
        }
        ORDER BY "createdAt" ${sort}, id ${sort}
        LIMIT ${pageSize + 1} OFFSET ${(page - 1) * pageSize}
      `;
    const orders = {
      registered: asInteger(counts.registered),
      confirmed: asInteger(counts.confirmed),
      awaitingReceipt: asInteger(counts.awaitingReceipt),
      rejectedReceipt: asInteger(counts.rejectedReceipt),
      pending: asInteger(counts.pending),
      paymentFailed: asInteger(counts.paymentFailed),
      reconciliation: asInteger(counts.reconciliation),
      cancelled: asInteger(counts.cancelled),
      expired: asInteger(counts.expired),
      overdueReservations: asInteger(counts.overdueReservations),
    };
    return {
      orders,
      hasMoreOrders: rows.length > pageSize,
      orderItems: rows
        .slice(0, pageSize)
        .map(({ createdAt, ...row }) => ({ ...row, createdAt: createdAt.toISOString() })),
    };
  }

  async readQuotas(tx: Prisma.TransactionClient, campaignId: string, page?: number) {
    const rows =
      page === undefined
        ? []
        : await tx.campaignQuota.findMany({
            where: { campaignId },
            orderBy: { productId: 'asc' },
            skip: (page - 1) * pageSize,
            take: pageSize + 1,
            select: {
              id: true,
              productId: true,
              limit: true,
              manualSold: true,
              revision: true,
              product: {
                select: {
                  slug: true,
                  name: true,
                  status: true,
                  deletedAt: true,
                  salePriceToman: true,
                  media: {
                    where: { media: { deletedAt: null, mimeType: { startsWith: 'image/' } } },
                    orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }, { mediaId: 'asc' }],
                    take: 1,
                    select: { media: { select: { storageKey: true } } },
                  },
                  variants: {
                    where: { deletedAt: null, isActive: true },
                    orderBy: { sku: 'asc' },
                    take: variantPreviewSize + 1,
                    select: { sku: true, name: true, salePriceToman: true },
                  },
                },
              },
            },
          });
    const quota = await campaignQuotaTotals(tx, campaignId);

    const items = rows.slice(0, pageSize);
    const usage = await quotaUsage(
      tx,
      items.map(({ id }) => id),
    );
    const stock = await quotaStock(
      tx,
      items.map(({ productId }) => productId),
    );
    return {
      quota,
      hasMoreQuotas: rows.length > pageSize,
      quotaItems: items.map((row) => {
        const counts = quotaCounts(row, usage);
        const sellableStock = stock.get(row.productId) ?? 0;
        const { product } = row;
        const image = product.media[0]?.media;
        return {
          slug: product.slug,
          name: product.name,
          productStatus: product.deletedAt ? ('DELETED' as const) : product.status,
          defaultPriceToman: product.salePriceToman,
          imageUrl: image ? this.mediaUrls.resolve(image.storageKey) : null,
          variants: product.variants.slice(0, variantPreviewSize).map((variant) => ({
            sku: variant.sku,
            name: variant.name,
            priceToman: variant.salePriceToman ?? product.salePriceToman,
          })),
          hasMoreVariants: product.variants.length > variantPreviewSize,
          productId: row.productId,
          revision: row.revision,
          ...counts,
          sellableStock,
          stockShortfall: Math.max(0, counts.remaining - sellableStock),
        };
      }),
    };
  }

  private async finance(tx: Prisma.TransactionClient, campaignId: string) {
    const [amounts] = await tx.$queryRaw<
      Array<{ merchandiseDiscountToman: bigint; shippingDiscountToman: bigint }>
    >`
      WITH confirmed_orders AS NOT MATERIALIZED (${confirmedGrowthOrders})
      SELECT ${confirmedCampaignDiscountSums}
      FROM "order_price_quotes" quote
      JOIN confirmed_orders paid ON paid.id = quote."orderId"
      WHERE quote."campaignId" = ${campaignId}::uuid
    `;
    return {
      confirmedMerchandiseDiscountToman: asInteger(amounts.merchandiseDiscountToman),
      confirmedShippingDiscountToman: asInteger(amounts.shippingDiscountToman),
    };
  }

  private async festivalStatus(
    tx: Prisma.TransactionClient,
    campaign: Campaign,
    landing: CampaignLanding | null,
    now: Date,
  ) {
    const { publication, ...visibility } = landing
      ? await this.landings.operationsVisibility(tx, campaign, landing, now)
      : {
          publication: 'NO_LANDING' as const,
          version: null,
          navigation: false,
          announcement: false,
        };
    const blocked =
      campaign.status === 'PAUSED'
        ? await tx.campaignRevision.findFirst({
            where: {
              campaignId: campaign.id,
              version: campaign.revision,
              action: 'PUBLICATION_BLOCKED',
            },
            select: { snapshot: true },
          })
        : null;
    const snapshot = blocked?.snapshot;
    const reason =
      snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot)
        ? snapshot.publicationError
        : null;
    const [health] = await tx.$queryRaw<
      { stockShortfallProducts: bigint; missingDefaultPriceProducts: bigint }[]
    >`
      WITH quotas AS MATERIALIZED (
        SELECT id, "productId", "limit", "manualSold"
        FROM "campaign_quotas" WHERE "campaignId" = ${campaign.id}::uuid
      ), usage AS (
        SELECT a."quotaId", SUM(a.quantity) AS units
        FROM quotas q JOIN "campaign_quota_allocations" a ON a."quotaId" = q.id
        WHERE a.state IN ('RESERVED', 'CAPTURED')
        GROUP BY a."quotaId"
      ), variants AS MATERIALIZED (
        SELECT v.id FROM quotas q JOIN "product_variants" v ON v."productId" = q."productId"
        WHERE v."isActive" AND v."deletedAt" IS NULL
      ), ${buildCatalogStockCte(
        true,
        Prisma.sql`SELECT id FROM variants UNION
          SELECT recipe."componentVariantId" FROM variants v
          JOIN "product_variant_components" recipe ON recipe."bundleVariantId" = v.id`,
      )}
      SELECT COUNT(*) FILTER (
        WHERE q."limit" - q."manualSold" - COALESCE(usage.units, 0) >
          CASE WHEN product.status = 'ACTIVE' AND product."deletedAt" IS NULL
            THEN ${catalogProductStockSql} ELSE 0 END
      ) AS "stockShortfallProducts",
      COUNT(*) FILTER (
        WHERE product.status = 'ACTIVE' AND product."deletedAt" IS NULL
          AND COALESCE(product."salePriceToman", 0) <= 0
      ) AS "missingDefaultPriceProducts"
      FROM quotas q
      JOIN "products" product ON product.id = q."productId"
      LEFT JOIN usage ON usage."quotaId" = q.id
    `;
    return {
      publication,
      festival: {
        ...visibility,
        publicationError: typeof reason === 'string' ? reason : null,
        stockShortfallProducts: asInteger(health.stockShortfallProducts),
        missingDefaultPriceProducts: asInteger(health.missingDefaultPriceProducts),
      },
    };
  }

  private async publication(
    tx: Prisma.TransactionClient,
    campaign: Campaign,
    landing: CampaignLanding | null,
    now: Date,
  ) {
    if (!landing) return 'NO_LANDING' as const;
    if (campaign.status !== 'ACTIVE' || campaign.startsAt > now || campaign.endsAt <= now)
      return 'INACTIVE' as const;
    try {
      const { total } = await readCampaignProducts(this.catalog, tx, campaign, landing, 1, 0);
      return total > 0 ? ('LIVE' as const) : ('EMPTY' as const);
    } catch (error) {
      if (error instanceof BadRequestException) return 'UNKNOWN' as const;
      throw error;
    }
  }
}
