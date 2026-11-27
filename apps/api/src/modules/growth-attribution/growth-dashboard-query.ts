import { Prisma } from '../../generated/prisma/client';
import type { GrowthDashboardQueryDto } from './dto/growth-dashboard.dto';
import { RevenueEventKind as Kind } from './dto/growth-revenue.dto';
import {
  growthCatalogConditions,
  growthRevenueEvents,
  hasGrowthCatalogScope,
} from './growth-revenue-events';

export const minimumChannelOrders = 20;

export function growthDashboardQuery(query: GrowthDashboardQueryDto, page: number, limit: number) {
  const eventSource = query.source ? Prisma.sql`AND event.source = ${query.source}` : Prisma.empty;
  const eventMedium = query.medium ? Prisma.sql`AND event.medium = ${query.medium}` : Prisma.empty;
  const eventCampaign = query.campaignId
    ? Prisma.sql`AND identity.id = ${query.campaignId}`
    : Prisma.empty;
  const eventDevice = query.device ? Prisma.sql`AND event.device = ${query.device}` : Prisma.empty;
  const catalogScope = hasGrowthCatalogScope(query);
  const eventCatalog = catalogScope
    ? Prisma.sql`AND EXISTS (
        SELECT 1 FROM products product
        WHERE product.slug = ANY(event."productSlugs") ${growthCatalogConditions(query)}
      )`
    : Prisma.empty;
  const costSource = query.source ? Prisma.sql`AND cost.source = ${query.source}` : Prisma.empty;
  const costMedium = query.medium ? Prisma.sql`AND cost.medium = ${query.medium}` : Prisma.empty;
  const costCampaign = query.campaignId
    ? Prisma.sql`AND cost."campaignId" = ${query.campaignId}`
    : Prisma.empty;
  const order =
    query.sort === 'net'
      ? Prisma.sql`("collectedToman" - "refundedToman") DESC,`
      : query.sort === 'spend'
        ? Prisma.sql`"recordedSpendToman" DESC NULLS LAST,`
        : Prisma.empty;
  const groupOrder = Prisma.sql`${order} "confirmedOrders" DESC, source ASC NULLS LAST,
    medium ASC NULLS LAST, "campaignId" ASC NULLS LAST, campaign ASC NULLS LAST`;

  return Prisma.sql`
    ${growthRevenueEvents(query, query)},
    spend AS MATERIALIZED (
      SELECT cost.day, cost.source, cost.medium, identity.campaign, cost."campaignId",
        SUM(cost."amountToman") AS amount
      FROM growth_campaign_costs cost
      JOIN campaign_link_identities identity ON identity.id = cost."campaignId"
      WHERE NOT ${catalogScope || Boolean(query.device)}
        AND cost.day BETWEEN ${query.from}::date AND ${query.to}::date
        ${costSource} ${costMedium} ${costCampaign}
      GROUP BY cost.day, cost.source, cost.medium, identity.campaign, cost."campaignId"
    ), spend_keys AS (
      SELECT DISTINCT source, medium, "campaignId" FROM spend
    ), first_purchases AS (
      SELECT buyer."userId", first_order.id, first_order."paidAt"
      FROM (
        SELECT DISTINCT placed."userId" FROM attributed activity
        JOIN orders placed ON placed.id = activity."orderId"
        WHERE activity.kind = ${Kind.PURCHASE_CONFIRMED}
      ) buyer
      CROSS JOIN LATERAL (
        SELECT purchase.id, purchase."paidAt" FROM confirmed_orders purchase
        WHERE purchase."userId" = buyer."userId"
        ORDER BY purchase."paidAt", purchase.id LIMIT 1
      ) first_order
    ), signals AS (
      SELECT event.source, event.medium, event.campaign, identity.id AS "campaignId",
        event.stage AS kind, event."visitId", NULL::uuid AS buyer, NULL::bigint AS amount,
        FALSE AS "confirmedSubmission", FALSE AS "hasSpend",
        (event."recordedAt" AT TIME ZONE 'Asia/Tehran')::date AS day,
        FALSE AS "newBuyer", FALSE AS "returningBuyer",
        NULL::integer AS discount, NULL::integer AS wallet
      FROM growth_funnel_events event CROSS JOIN report_period
      LEFT JOIN campaign_link_identities identity ON identity.id = event."campaignId" AND identity.campaign = event.campaign
      WHERE event."recordedAt" >= report_period.starts_at AND event."recordedAt" < report_period.ends_before
        ${eventSource} ${eventMedium} ${eventCampaign} ${eventDevice} ${eventCatalog}

      UNION ALL
      SELECT orders.source, orders.medium, orders.campaign, orders."campaignId", orders.kind,
        NULL::uuid, placed."userId", orders."amountToman"::bigint,
        confirmed.id IS NOT NULL,
        cost."campaignId" IS NOT NULL,
        (orders."occurredAt" AT TIME ZONE 'Asia/Tehran')::date,
        first_purchase.id = placed.id,
        first_purchase."paidAt" < report_period.starts_at,
        orders."orderDiscountToman", orders."walletAppliedToman"
      FROM attributed orders
      JOIN "orders" placed ON placed.id = orders."orderId"
      CROSS JOIN report_period
      LEFT JOIN confirmed_orders confirmed ON orders.kind = ${Kind.ORDER_SUBMITTED}
        AND confirmed.id = orders."orderId" AND confirmed."paidAt" < report_period.ends_before
      LEFT JOIN first_purchases first_purchase ON orders.kind = ${Kind.PURCHASE_CONFIRMED}
        AND first_purchase."userId" = placed."userId"
      LEFT JOIN spend_keys cost ON orders.kind = ${Kind.PURCHASE_CONFIRMED}
        AND cost.source = orders.source AND cost.medium = orders.medium AND cost."campaignId" = orders."campaignId"
      WHERE orders.kind IN (${Kind.ORDER_SUBMITTED}, ${Kind.PURCHASE_CONFIRMED}, ${Kind.REFUND_ADJUSTMENT})

      UNION ALL
      SELECT source, medium, campaign, "campaignId", 'recorded_spend',
        NULL::uuid, NULL::uuid, amount, FALSE, FALSE, day, FALSE, FALSE, NULL, NULL
      FROM spend
    ), totals AS MATERIALIZED (
      SELECT
        GROUPING(source, day) = 3 AS "isTotal", to_char(day, 'YYYY-MM-DD') AS day,
        source, medium, campaign, "campaignId",
        COUNT(DISTINCT buyer) FILTER (WHERE kind = ${Kind.PURCHASE_CONFIRMED}) AS "confirmedCustomers",
        COUNT(DISTINCT buyer) FILTER (WHERE "newBuyer") AS "newCustomers",
        COUNT(DISTINCT buyer) FILTER (WHERE "returningBuyer") AS "returningCustomers",
        COUNT(*) FILTER (WHERE kind = ${Kind.ORDER_SUBMITTED}) AS "submittedOrders",
        COUNT(*) FILTER (WHERE kind = ${Kind.PURCHASE_CONFIRMED}) AS "confirmedOrders",
        COUNT(*) FILTER (WHERE kind = ${Kind.PURCHASE_CONFIRMED} AND "campaignId" IS NOT NULL)
          AS "campaignAttributedOrders",
        COUNT(*) FILTER (WHERE "confirmedSubmission") AS "confirmedSubmissions",
        COUNT(*) FILTER (WHERE "hasSpend") AS "ordersWithRecordedSpend",
        COALESCE(SUM(amount) FILTER (WHERE kind = ${Kind.PURCHASE_CONFIRMED}), 0)::bigint AS "collectedToman",
        COALESCE(SUM(amount) FILTER (WHERE kind = ${Kind.REFUND_ADJUSTMENT}), 0)::bigint AS "refundedToman",
        COALESCE(SUM(discount), 0)::bigint AS "orderDiscountToman",
        CASE WHEN COUNT(wallet) = COUNT(*) FILTER (WHERE kind = ${Kind.PURCHASE_CONFIRMED})
          THEN COALESCE(SUM(wallet), 0)::bigint END AS "walletAppliedToman",
        (SUM(amount) FILTER (WHERE kind = 'recorded_spend'))::bigint AS "recordedSpendToman",
        COUNT(DISTINCT "visitId") AS "measuredVisits",
        COUNT(*) FILTER (WHERE kind = 'view_item_list') AS "itemListViews",
        COUNT(*) FILTER (WHERE kind = 'select_item') AS "itemSelections",
        COUNT(*) FILTER (WHERE kind = 'view_item') AS "itemViews",
        COUNT(*) FILTER (WHERE kind = 'add_to_cart') AS "cartAdds",
        COUNT(*) FILTER (WHERE kind = 'begin_checkout') AS checkouts,
        COUNT(DISTINCT "visitId") FILTER (WHERE kind = 'view_item_list') AS "itemList",
        COUNT(DISTINCT "visitId") FILTER (WHERE kind = 'view_item') AS item,
        COUNT(DISTINCT "visitId") FILTER (WHERE kind = 'add_to_cart') AS cart,
        COUNT(DISTINCT "visitId") FILTER (WHERE kind = 'begin_checkout') AS checkout
      FROM signals
      GROUP BY GROUPING SETS ((), (source, medium, campaign, "campaignId"), (day))
    ), report_groups AS (
      SELECT * FROM totals WHERE NOT "isTotal" AND day IS NULL
    ), campaign_counts AS (
      SELECT "campaignId", SUM("confirmedOrders")::bigint AS purchases
      FROM report_groups
      WHERE "campaignId" IS NOT NULL AND "confirmedOrders" > 0
      GROUP BY "campaignId"
    ), campaign_leader AS (
      SELECT *, LEAD(purchases) OVER (ORDER BY purchases DESC, "campaignId") AS "runnerUp"
      FROM campaign_counts
      ORDER BY purchases DESC, "campaignId" LIMIT 1
    ), channel_counts AS (
      SELECT medium, SUM("submittedOrders")::bigint AS submitted,
        SUM("confirmedSubmissions")::bigint AS confirmed,
        SUM("confirmedSubmissions") / SUM("submittedOrders") AS rate
      FROM report_groups
      WHERE medium IS NOT NULL AND "submittedOrders" > 0
      GROUP BY medium HAVING SUM("submittedOrders") >= ${minimumChannelOrders}
    ), channel_leader AS (
      SELECT *, LEAD(rate) OVER (ORDER BY rate DESC, medium) AS "runnerUp"
      FROM channel_counts
      ORDER BY rate DESC, medium LIMIT 1
    ), page_items AS (
      SELECT * FROM report_groups
      ORDER BY ${groupOrder}
      LIMIT ${limit} OFFSET ${(page - 1) * limit}
    )
    SELECT dashboard.*, (SELECT COUNT(*) FROM report_groups) AS total,
      campaign_leader."campaignId" AS "leaderId",
      COALESCE(identity.campaign, campaign_leader."campaignId") AS "leaderLabel",
      campaign_leader.purchases AS "leaderPurchases",
      channel_leader.medium AS "leaderMedium", channel_leader.submitted AS "leaderSubmitted",
      channel_leader.confirmed AS "leaderConfirmed"
    FROM (
      SELECT * FROM totals WHERE "isTotal"
      UNION ALL
      SELECT * FROM page_items
      UNION ALL
      SELECT * FROM totals WHERE day IS NOT NULL
    ) dashboard
    LEFT JOIN campaign_leader ON dashboard."isTotal" AND campaign_leader.purchases > campaign_leader."runnerUp"
    LEFT JOIN campaign_link_identities identity ON identity.id = campaign_leader."campaignId"
    LEFT JOIN channel_leader ON dashboard."isTotal" AND channel_leader.rate > channel_leader."runnerUp"
    ORDER BY "isTotal" DESC, day ASC NULLS FIRST, ${groupOrder}
  `;
}
