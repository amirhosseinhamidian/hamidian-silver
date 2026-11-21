import { Prisma } from '../../generated/prisma/client';
import type { GrowthDashboardQueryDto } from './dto/growth-dashboard.dto';
import { RevenueEventKind as Kind } from './dto/growth-revenue.dto';
import { growthRevenueEvents } from './growth-revenue-events';

export function growthDashboardQuery(query: GrowthDashboardQueryDto, page: number, limit: number) {
  const eventSource = query.source ? Prisma.sql`AND event.source = ${query.source}` : Prisma.empty;
  const eventMedium = query.medium ? Prisma.sql`AND event.medium = ${query.medium}` : Prisma.empty;
  const eventCampaign = query.campaignId
    ? Prisma.sql`AND identity.id = ${query.campaignId}`
    : Prisma.empty;
  const eventDevice = query.device ? Prisma.sql`AND event.device = ${query.device}` : Prisma.empty;
  const eventCategory = query.category
    ? Prisma.sql`AND EXISTS (
        SELECT 1 FROM products product
        JOIN product_categories membership ON membership."productId" = product.id
        JOIN categories category ON category.id = membership."categoryId"
        WHERE product.slug = ANY(event."productSlugs") AND category.slug = ${query.category}
          AND category."isActive" AND category."deletedAt" IS NULL
      )`
    : Prisma.empty;
  const costSource = query.source ? Prisma.sql`AND cost.source = ${query.source}` : Prisma.empty;
  const costMedium = query.medium ? Prisma.sql`AND cost.medium = ${query.medium}` : Prisma.empty;
  const costCampaign = query.campaignId
    ? Prisma.sql`AND cost."campaignId" = ${query.campaignId}`
    : Prisma.empty;

  return Prisma.sql`
    ${growthRevenueEvents(query, query)},
    spend AS MATERIALIZED (
      SELECT cost.source, cost.medium, identity.campaign, cost."campaignId", SUM(cost."amountToman") AS amount
      FROM growth_campaign_costs cost
      JOIN campaign_link_identities identity ON identity.id = cost."campaignId"
      WHERE NOT ${Boolean(query.category || query.device)}
        AND cost.day BETWEEN ${query.from}::date AND ${query.to}::date
        ${costSource} ${costMedium} ${costCampaign}
      GROUP BY cost.source, cost.medium, identity.campaign, cost."campaignId"
    ), signals AS (
      SELECT event.source, event.medium, event.campaign, identity.id AS "campaignId",
        event.stage AS kind, event."visitId", NULL::uuid AS buyer, NULL::bigint AS amount,
        FALSE AS "confirmedSubmission", FALSE AS "hasSpend"
      FROM growth_funnel_events event CROSS JOIN report_period
      LEFT JOIN campaign_link_identities identity ON identity.id = event."campaignId" AND identity.campaign = event.campaign
      WHERE event."recordedAt" >= report_period.starts_at AND event."recordedAt" < report_period.ends_before
        ${eventSource} ${eventMedium} ${eventCampaign} ${eventDevice} ${eventCategory}

      UNION ALL
      SELECT orders.source, orders.medium, orders.campaign, orders."campaignId", orders.kind,
        NULL::uuid, placed."userId", orders."amountToman"::bigint,
        confirmed.id IS NOT NULL,
        cost."campaignId" IS NOT NULL
      FROM attributed orders
      JOIN "orders" placed ON placed.id = orders."orderId"
      CROSS JOIN report_period
      LEFT JOIN confirmed_orders confirmed ON orders.kind = ${Kind.ORDER_SUBMITTED}
        AND confirmed.id = orders."orderId" AND confirmed."paidAt" < report_period.ends_before
      LEFT JOIN spend cost ON orders.kind = ${Kind.PURCHASE_CONFIRMED}
        AND cost.source = orders.source AND cost.medium = orders.medium AND cost."campaignId" = orders."campaignId"
      WHERE orders.kind IN (${Kind.ORDER_SUBMITTED}, ${Kind.PURCHASE_CONFIRMED}, ${Kind.REFUND_ADJUSTMENT})

      UNION ALL
      SELECT source, medium, campaign, "campaignId", 'recorded_spend', NULL::uuid, NULL::uuid, amount, FALSE, FALSE
      FROM spend
    ), totals AS MATERIALIZED (
      SELECT
        GROUPING(source) = 1 AS "isTotal", source, medium, campaign, "campaignId",
        COUNT(DISTINCT buyer) FILTER (WHERE kind = ${Kind.PURCHASE_CONFIRMED}) AS "confirmedCustomers",
        COUNT(*) FILTER (WHERE kind = ${Kind.ORDER_SUBMITTED}) AS "submittedOrders",
        COUNT(*) FILTER (WHERE kind = ${Kind.PURCHASE_CONFIRMED}) AS "confirmedOrders",
        COUNT(*) FILTER (WHERE "confirmedSubmission") AS "confirmedSubmissions",
        COUNT(*) FILTER (WHERE "hasSpend") AS "ordersWithRecordedSpend",
        COALESCE(SUM(amount) FILTER (WHERE kind = ${Kind.PURCHASE_CONFIRMED}), 0)::bigint AS "collectedToman",
        COALESCE(SUM(amount) FILTER (WHERE kind = ${Kind.REFUND_ADJUSTMENT}), 0)::bigint AS "refundedToman",
        (SUM(amount) FILTER (WHERE kind = 'recorded_spend'))::bigint AS "recordedSpendToman",
        COUNT(DISTINCT "visitId") AS "measuredVisits",
        COUNT(*) FILTER (WHERE kind = 'view_item_list') AS "itemListViews",
        COUNT(*) FILTER (WHERE kind = 'select_item') AS "itemSelections",
        COUNT(*) FILTER (WHERE kind = 'view_item') AS "itemViews",
        COUNT(*) FILTER (WHERE kind = 'add_to_cart') AS "cartAdds",
        COUNT(*) FILTER (WHERE kind = 'begin_checkout') AS checkouts
      FROM signals
      GROUP BY GROUPING SETS ((), (source, medium, campaign, "campaignId"))
    ), page_items AS (
      SELECT * FROM totals WHERE NOT "isTotal"
      ORDER BY "confirmedOrders" DESC, source ASC NULLS LAST, medium ASC NULLS LAST,
        "campaignId" ASC NULLS LAST, campaign ASC NULLS LAST
      LIMIT ${limit} OFFSET ${(page - 1) * limit}
    )
    SELECT *, (SELECT COUNT(*) FROM totals WHERE NOT "isTotal") AS total FROM (
      SELECT * FROM totals WHERE "isTotal"
      UNION ALL
      SELECT * FROM page_items
    ) dashboard
    ORDER BY "isTotal" DESC, "confirmedOrders" DESC, source ASC NULLS LAST, medium ASC NULLS LAST,
      "campaignId" ASC NULLS LAST, campaign ASC NULLS LAST
  `;
}
