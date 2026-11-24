import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma, type Campaign, type CampaignLanding } from '../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { CatalogService } from '../catalog/catalog.service';
import { confirmedCampaignDiscountSums } from '../growth-attribution/growth-campaign-performance-query';
import { confirmedGrowthOrders } from '../growth-attribution/growth-revenue-events';
import { readCampaignProducts } from './campaign-collection';
import { quotaCounts, quotaStock, quotaUsage } from './campaign-quota';
import type {
  CampaignOperationsCenterDto,
  CampaignOperationsQueryDto,
  CampaignOrderCountsDto,
  CampaignOrderOperationDto,
} from './dto/campaign-operations-center.dto';

const pageSize = 25;
type OrderRow = Omit<CampaignOrderOperationDto, 'createdAt'> & { createdAt: Date };
type CountRow = { [Key in keyof CampaignOrderCountsDto]: bigint };

function asInteger(value: bigint) {
  const result = Number(value);
  if (!Number.isSafeInteger(result))
    throw new ServiceUnavailableException('Campaign metrics exceed the supported range.');
  return result;
}

function scopedOrders({ id, trackingId }: Pick<Campaign, 'id' | 'trackingId'>) {
  return Prisma.sql`
    WITH campaign_orders AS (
      SELECT "orderId" AS id, TRUE AS "discountApplied"
        FROM "order_price_quotes" WHERE "campaignId" = ${id}::uuid
      UNION ALL
      SELECT attribution."orderId", FALSE
        FROM "order_attributions" attribution
        WHERE attribution."campaignId" = ${trackingId} AND NOT EXISTS (
          SELECT 1 FROM "order_price_quotes" quote
          WHERE quote."orderId" = attribution."orderId" AND quote."campaignId" = ${id}::uuid
        )
    ), confirmed_orders AS NOT MATERIALIZED (${confirmedGrowthOrders}),
    classified AS (
      SELECT o.id, o."orderNumber" AS number, o."createdAt", o."reservationExpiresAt",
        campaign_orders."discountApplied",
        CASE
          WHEN p.status = 'RECONCILIATION_REQUIRED' OR EXISTS (
            SELECT 1 FROM "payment_attempts" a
            JOIN "payment_reconciliations" r ON r."paymentAttemptId" = a.id
            WHERE a."paymentId" = p.id AND r.status = 'OPEN'
          ) THEN 'RECONCILIATION'
          WHEN confirmed.id IS NOT NULL THEN 'CONFIRMED'
          WHEN o.status = 'CANCELLED' THEN 'CANCELLED'
          WHEN o.status = 'EXPIRED' THEN 'EXPIRED'
          WHEN p.status = 'AWAITING_REVIEW' THEN 'RECEIPT_REVIEW'
          WHEN latest."receiptRejectedAt" IS NOT NULL THEN 'RECEIPT_REJECTED'
          WHEN latest.status = 'FAILED' AND latest."failureCode" IS DISTINCT FROM 'PAYMENT_METHOD_CHANGED'
            THEN 'PAYMENT_FAILED'
          ELSE 'PENDING'
        END AS state,
        confirmed.id IS NOT NULL AS confirmed,
        o.status = 'PENDING_PAYMENT' AND (
          p.id IS NULL OR p.status IN ('PENDING', 'CANCELLED')
        ) AS "waitingForPayment"
      FROM campaign_orders
      JOIN "orders" o ON o.id = campaign_orders.id
      LEFT JOIN "payments" p ON p."orderId" = o.id
      LEFT JOIN confirmed_orders confirmed ON confirmed.id = o.id
      LEFT JOIN LATERAL (
        SELECT a.status, a."receiptRejectedAt", a."failureCode"
        FROM "payment_attempts" a WHERE a."paymentId" = p.id
        ORDER BY a."createdAt" DESC, a.id DESC LIMIT 1
      ) latest ON TRUE
    )
  `;
}

@Injectable()
export class CampaignOperationsCenterService {
  constructor(
    private readonly db: PrismaService,
    private readonly catalog: CatalogService,
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
          include: { landing: true },
        });
        if (!campaign) throw new NotFoundException('Campaign not found.');

        const orderPage = query.orderPage ?? 1;
        const quotaPage = query.quotaPage ?? 1;
        const orders = await this.orders(tx, campaign, orderPage, query.orderState, now);
        const quotas = await this.quotas(tx, campaignId, quotaPage);
        const finance = includeFinance ? await this.finance(tx, campaignId) : null;
        const publication = await this.publication(tx, campaign, campaign.landing, now);

        return {
          ...orders,
          ...quotas,
          orderPage,
          quotaPage,
          finance,
          publication,
          landingSlug: campaign.landing?.slug ?? null,
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
    state: CampaignOperationsQueryDto['orderState'],
    now: Date,
  ) {
    const scope = scopedOrders(campaign);
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
          COUNT(*) FILTER (WHERE "waitingForPayment" AND "reservationExpiresAt" <= ${now}) AS "overdueReservations"
        FROM classified
      `;
    const rows = await tx.$queryRaw<OrderRow[]>`
        ${scope}
        SELECT id, number, "createdAt", state, "discountApplied" FROM classified
        ${
          state === 'CONFIRMED'
            ? Prisma.sql`WHERE confirmed`
            : state
              ? Prisma.sql`WHERE state = ${state}`
              : Prisma.empty
        }
        ORDER BY "createdAt" DESC, id DESC
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

  private async quotas(tx: Prisma.TransactionClient, campaignId: string, page: number) {
    const rows = await tx.campaignQuota.findMany({
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
        product: { select: { slug: true, name: true } },
      },
    });
    const totals = await tx.campaignQuota.aggregate({
      where: { campaignId },
      _sum: { limit: true, manualSold: true },
      _count: { _all: true },
    });
    const allocations = await tx.campaignQuotaAllocation.groupBy({
      by: ['state'],
      where: { quota: { campaignId }, state: { in: ['RESERVED', 'CAPTURED'] } },
      _sum: { quantity: true },
    });

    const items = rows.slice(0, pageSize);
    const usage = await quotaUsage(
      tx,
      items.map(({ id }) => id),
    );
    const stock = await quotaStock(
      tx,
      items.map(({ productId }) => productId),
    );
    const siteSold = allocations.find(({ state }) => state === 'CAPTURED')?._sum.quantity ?? 0;
    const reserved = allocations.find(({ state }) => state === 'RESERVED')?._sum.quantity ?? 0;
    const limit = totals._sum.limit ?? 0;
    const manualSold = totals._sum.manualSold ?? 0;
    return {
      quota: {
        products: totals._count._all,
        limit,
        manualSold,
        siteSold,
        reserved,
        remaining: Math.max(0, limit - manualSold - siteSold - reserved),
      },
      hasMoreQuotas: rows.length > pageSize,
      quotaItems: items.map((row) => {
        const counts = quotaCounts(row, usage);
        const sellableStock = stock.get(row.productId) ?? 0;
        return {
          ...row.product,
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
