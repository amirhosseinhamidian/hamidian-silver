import { Prisma } from '../../generated/prisma/client';
import type { GrowthCampaignPerformanceQueryDto } from './dto/growth-campaign-performance.dto';
import { RevenueEventKind as Kind } from './dto/growth-revenue.dto';
import {
  confirmedGrowthOrders,
  growthReportPeriodSql,
  growthRevenueEvents,
} from './growth-revenue-events';

export const confirmedCampaignDiscountSums = Prisma.sql`
  COALESCE(SUM(quote."merchandiseDiscountToman"), 0)::bigint AS "merchandiseDiscountToman",
  COALESCE(SUM(quote."shippingDiscountToman"), 0)::bigint AS "shippingDiscountToman"
`;

export function growthCampaignPerformanceQuery(
  query: GrowthCampaignPerformanceQueryDto,
  trackingId: string,
  campaignId: string | null,
) {
  return Prisma.sql`
    WITH report_period AS (${growthReportPeriodSql(query)}),
    confirmed_orders AS NOT MATERIALIZED (${confirmedGrowthOrders}),
    quotes AS MATERIALIZED (
      SELECT "orderId", "merchandiseDiscountToman", "shippingDiscountToman"
      FROM order_price_quotes WHERE "campaignId" = ${campaignId}::uuid
    ), sales AS (
      SELECT quote.*,
        placed."createdAt" >= period.starts_at AND placed."createdAt" < period.ends_before AS submitted,
        paid."paidAt" >= period.starts_at AND paid."paidAt" < period.ends_before AS confirmed,
        paid."paidAt" < period.ends_before AS "confirmedBeforeEnd",
        COALESCE(finance."customerTotalToman", paid."amountToman") AS collected
      FROM quotes quote
      JOIN orders placed ON placed.id = quote."orderId"
      CROSS JOIN report_period period
      LEFT JOIN confirmed_orders paid ON paid.id = placed.id
      LEFT JOIN order_finance_snapshots finance ON finance."orderId" = paid.id
    )
    SELECT offer.*, refunds."refundedToman", media."lifetimeMediaSpendToman"
    FROM (
      SELECT COUNT(*) > 0 AS "hasOfferHistory",
        COUNT(*) FILTER (WHERE submitted) AS "submittedOrders",
        COUNT(*) FILTER (WHERE confirmed) AS "confirmedOrders",
        COUNT(*) FILTER (WHERE submitted AND "confirmedBeforeEnd") AS "confirmedSubmissions",
        COALESCE(SUM(collected) FILTER (WHERE confirmed), 0)::bigint AS "collectedToman",
        COALESCE(SUM("merchandiseDiscountToman") FILTER (WHERE confirmed), 0)::bigint AS "merchandiseDiscountToman",
        COALESCE(SUM("shippingDiscountToman") FILTER (WHERE confirmed), 0)::bigint AS "shippingDiscountToman"
      FROM sales
    ) offer
    CROSS JOIN (
      SELECT COALESCE(SUM(refund."amountToman"), 0)::bigint AS "refundedToman"
      FROM quotes quote
      JOIN payments payment ON payment."orderId" = quote."orderId"
      JOIN payment_refunds refund ON refund."paymentId" = payment.id
      CROSS JOIN report_period
      WHERE refund.status = 'CONFIRMED'
        AND refund."confirmedAt" >= report_period.starts_at AND refund."confirmedAt" < report_period.ends_before
    ) refunds
    CROSS JOIN (
      SELECT SUM("amountToman")::bigint AS "lifetimeMediaSpendToman"
      FROM growth_campaign_costs WHERE "campaignId" = ${trackingId}
    ) media
  `;
}

export function growthCampaignTrackingQuery(
  query: GrowthCampaignPerformanceQueryDto,
  campaignId: string,
  page: number,
  pageSize: number,
) {
  return Prisma.sql`
    ${growthRevenueEvents({ from: query.from, to: query.to, campaignId })}
    SELECT source, medium, content,
      COUNT(*) FILTER (WHERE kind = ${Kind.ORDER_SUBMITTED}) AS "submittedOrders",
      COUNT(*) FILTER (WHERE kind = ${Kind.PURCHASE_CONFIRMED}) AS "confirmedOrders",
      (COALESCE(SUM("amountToman") FILTER (WHERE kind = ${Kind.PURCHASE_CONFIRMED}), 0) -
        COALESCE(SUM("amountToman") FILTER (WHERE kind = ${Kind.REFUND_ADJUSTMENT}), 0))::bigint
        AS "netCollectedToman"
    FROM attributed
    WHERE content IS NOT NULL AND content <> ''
      AND kind IN (${Kind.ORDER_SUBMITTED}, ${Kind.PURCHASE_CONFIRMED}, ${Kind.REFUND_ADJUSTMENT})
    GROUP BY source, medium, content
    ORDER BY "confirmedOrders" DESC, "submittedOrders" DESC, source, medium, content
    LIMIT ${pageSize + 1} OFFSET ${(page - 1) * pageSize}
  `;
}

export function growthCampaignHistoryQuery(
  query: GrowthCampaignPerformanceQueryDto,
  campaignId: string,
  page: number,
  pageSize: number,
) {
  return Prisma.sql`
    WITH report_period AS (${growthReportPeriodSql(query)}),
    activity AS (
      SELECT 'attribution'::text AS kind, o.id AS "orderId", o."createdAt" AS "occurredAt"
      FROM orders o
      JOIN order_attributions attribution ON attribution."orderId" = o.id
      CROSS JOIN report_period
      WHERE o."createdAt" >= report_period.starts_at AND o."createdAt" < report_period.ends_before
        AND (${campaignId} IN (
          attribution."campaignId", attribution."firstTouch"->>'campaignId',
          attribution."lastTouch"->>'campaignId'
        ))
      UNION ALL
      SELECT 'cancellation'::text, o.id, o."cancelledAt"
      FROM orders o
      JOIN order_attributions attribution ON attribution."orderId" = o.id
      CROSS JOIN report_period
      WHERE o."cancelledAt" >= report_period.starts_at AND o."cancelledAt" < report_period.ends_before
        AND attribution."campaignId" = ${campaignId}
    ), page_items AS (
      SELECT * FROM activity
      ORDER BY "occurredAt" DESC, "orderId" DESC, kind ASC
      LIMIT ${pageSize + 1} OFFSET ${(page - 1) * pageSize}
    )
    SELECT page_items.*, attribution.model::text AS model, attribution."policyVersion",
      attribution."firstTouch"->>'campaignId' AS "firstCampaignId",
      attribution."lastTouch"->>'campaignId' AS "lastCampaignId",
      attribution."campaignId" AS "selectedCampaignId"
    FROM page_items
    JOIN order_attributions attribution ON attribution."orderId" = page_items."orderId"
    ORDER BY "occurredAt" DESC, "orderId" DESC, kind ASC
  `;
}
