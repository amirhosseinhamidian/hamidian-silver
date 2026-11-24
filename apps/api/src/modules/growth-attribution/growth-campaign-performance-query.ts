import { Prisma } from '../../generated/prisma/client';
import type { GrowthCampaignPerformanceQueryDto } from './dto/growth-campaign-performance.dto';
import { confirmedGrowthOrders, growthReportPeriodSql } from './growth-revenue-events';

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
    confirmed_orders AS NOT MATERIALIZED (${confirmedGrowthOrders})
    SELECT (
      SELECT COUNT(*)
      FROM order_attributions attribution
      JOIN confirmed_orders paid ON paid.id = attribution."orderId"
      CROSS JOIN report_period
      WHERE attribution."campaignId" = ${trackingId}
        AND paid."paidAt" >= report_period.starts_at AND paid."paidAt" < report_period.ends_before
        AND NOT EXISTS (
          SELECT 1 FROM confirmed_orders earlier
          WHERE earlier."userId" = paid."userId"
            AND (earlier."paidAt", earlier.id) < (paid."paidAt", paid.id)
        )
    ) AS "newCustomers", discount.*, media."lifetimeMediaSpendToman"
    FROM (
      SELECT ${confirmedCampaignDiscountSums}
      FROM order_price_quotes quote
      JOIN confirmed_orders paid ON paid.id = quote."orderId"
      CROSS JOIN report_period
      WHERE quote."campaignId" = ${campaignId}::uuid
        AND paid."paidAt" >= report_period.starts_at AND paid."paidAt" < report_period.ends_before
    ) discount
    CROSS JOIN (
      SELECT SUM("amountToman")::bigint AS "lifetimeMediaSpendToman"
      FROM growth_campaign_costs WHERE "campaignId" = ${trackingId}
    ) media
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
