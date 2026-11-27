import { Prisma } from '../../generated/prisma/client';
import type { GrowthDashboardQueryDto } from './dto/growth-dashboard.dto';
import { type GrowthRevenueQueryDto, RevenueEventKind as Kind } from './dto/growth-revenue.dto';

export const confirmedGrowthOrders = Prisma.sql`
  SELECT orders.id, orders."userId", orders."paidAt", orders."deliveredAt",
    payment.id AS "paymentId", payment."amountToman"
  FROM "orders" AS orders
  JOIN "payments" AS payment ON payment."orderId" = orders.id
  WHERE orders."paidAt" IS NOT NULL AND payment.status IN ('PAID', 'PARTIALLY_REFUNDED', 'REFUNDED')
`;

export function growthReportPeriodSql({ from, to }: Pick<GrowthRevenueQueryDto, 'from' | 'to'>) {
  return Prisma.sql`
    SELECT
      ${from}::date::timestamp AT TIME ZONE 'Asia/Tehran' AS starts_at,
      (${to}::date + 1)::timestamp AT TIME ZONE 'Asia/Tehran' AS ends_before
  `;
}

type CatalogScope = Pick<GrowthDashboardQueryDto, 'category' | 'product' | 'brand'>;

export function hasGrowthCatalogScope(scope?: CatalogScope) {
  return Boolean(scope?.category || scope?.product || scope?.brand);
}

// The caller supplies a single product row so combined filters describe the same item.
export function growthCatalogConditions(scope?: CatalogScope) {
  return Prisma.sql`
    ${scope?.product ? Prisma.sql`AND product.slug = ${scope.product}` : Prisma.empty}
    ${
      scope?.brand
        ? Prisma.sql`AND EXISTS (
      SELECT 1 FROM brands brand WHERE brand.id = product."brandId" AND brand.slug = ${scope.brand}
    )`
        : Prisma.empty
    }
    ${
      scope?.category
        ? Prisma.sql`AND EXISTS (
      SELECT 1 FROM product_categories membership
      JOIN categories category ON category.id = membership."categoryId"
      WHERE membership."productId" = product.id AND category.slug = ${scope.category}
        AND category."isActive" AND category."deletedAt" IS NULL
    )`
        : Prisma.empty
    }
  `;
}

export function growthRevenueEvents(
  query: GrowthRevenueQueryDto,
  scope?: CatalogScope & Pick<GrowthDashboardQueryDto, 'device'>,
) {
  const within = (time: Prisma.Sql) =>
    Prisma.sql`${time} >= report_period.starts_at AND ${time} < report_period.ends_before`;
  const source = query.source ? Prisma.sql`AND attribution.source = ${query.source}` : Prisma.empty;
  const medium = query.medium ? Prisma.sql`AND attribution.medium = ${query.medium}` : Prisma.empty;
  const campaign = query.campaignId
    ? Prisma.sql`AND attribution."campaignId" = ${query.campaignId}`
    : Prisma.empty;
  const catalog = hasGrowthCatalogScope(scope)
    ? Prisma.sql`AND EXISTS (
        SELECT 1 FROM "order_items" item
        JOIN "product_variants" variant ON variant.id = item."variantId"
        JOIN products product ON product.id = variant."productId"
        WHERE item."orderId" = orders.id ${growthCatalogConditions(scope)}
      )`
    : Prisma.empty;
  const device =
    scope?.device === 'unknown'
      ? Prisma.sql`AND orders."growthDevice" IS NULL`
      : scope?.device
        ? Prisma.sql`AND orders."growthDevice" = ${scope.device}`
        : Prisma.empty;

  return Prisma.sql`
    WITH report_period AS (
      ${growthReportPeriodSql(query)}
    ), confirmed_orders AS NOT MATERIALIZED (
      ${confirmedGrowthOrders}
    ), activity AS (
      SELECT orders.id AS "entityId", orders.id AS "orderId", ${Kind.ORDER_SUBMITTED}::text AS kind,
        orders."createdAt" AS "occurredAt", orders."grandTotalToman" AS amount, NULL::text AS provider, FALSE AS "awaitingReview"
      FROM "orders" AS orders CROSS JOIN report_period
      WHERE ${within(Prisma.sql`orders."createdAt"`)}

      UNION ALL
      SELECT attempt.id, payment."orderId", ${Kind.RECEIPT_SUBMITTED}::text, attempt."receiptUploadedAt",
        NULL, attempt.provider, attempt.status = 'AWAITING_REVIEW' AND payment.status = 'AWAITING_REVIEW'
      FROM "payment_attempts" AS attempt
      JOIN "payments" AS payment ON payment.id = attempt."paymentId"
      CROSS JOIN report_period
      WHERE attempt.provider = 'card_to_card' AND ${within(Prisma.sql`attempt."receiptUploadedAt"`)}

      UNION ALL
      SELECT attempt.id, payment."orderId", ${Kind.RECEIPT_REJECTED}::text, attempt."receiptRejectedAt", NULL, attempt.provider, FALSE
      FROM "payment_attempts" AS attempt
      JOIN "payments" AS payment ON payment.id = attempt."paymentId"
      CROSS JOIN report_period
      WHERE ${within(Prisma.sql`attempt."receiptRejectedAt"`)}

      UNION ALL
      SELECT reconciliation.id, payment."orderId", ${Kind.RECONCILIATION_REQUIRED}::text, reconciliation."createdAt", NULL, reconciliation.provider, FALSE
      FROM "payment_reconciliations" AS reconciliation
      JOIN "payment_attempts" AS attempt ON attempt.id = reconciliation."paymentAttemptId"
      JOIN "payments" AS payment ON payment.id = attempt."paymentId"
      CROSS JOIN report_period
      WHERE ${within(Prisma.sql`reconciliation."createdAt"`)}

      UNION ALL
      SELECT confirmed.id, confirmed.id, ${Kind.PURCHASE_CONFIRMED}::text, confirmed."paidAt", confirmed."amountToman", verified.provider, FALSE
      FROM confirmed_orders AS confirmed
      CROSS JOIN report_period
      LEFT JOIN LATERAL (
        SELECT attempt.provider
        FROM "payment_attempts" AS attempt
        WHERE attempt."paymentId" = confirmed."paymentId" AND attempt.status = 'VERIFIED'
        ORDER BY (attempt."verifiedAt" = confirmed."paidAt") DESC NULLS LAST,
          attempt."verifiedAt" DESC NULLS LAST, attempt.id
        LIMIT 1
      ) AS verified ON TRUE
      WHERE ${within(Prisma.sql`confirmed."paidAt"`)}

      UNION ALL
      SELECT confirmed.id, confirmed.id, ${Kind.ORDER_DELIVERED}::text, confirmed."deliveredAt", NULL, NULL, FALSE
      FROM confirmed_orders AS confirmed CROSS JOIN report_period
      WHERE ${within(Prisma.sql`confirmed."deliveredAt"`)}

      UNION ALL
      SELECT orders.id, orders.id, ${Kind.CANCELLATION}::text, orders."cancelledAt", NULL, NULL, FALSE
      FROM "orders" AS orders CROSS JOIN report_period
      WHERE ${within(Prisma.sql`orders."cancelledAt"`)}

      UNION ALL
      SELECT history.id, history."orderId", ${Kind.ORDER_EXPIRED}::text, history."createdAt", NULL, NULL, FALSE
      FROM "order_status_history" AS history CROSS JOIN report_period
      WHERE history."toStatus" = 'EXPIRED' AND ${within(Prisma.sql`history."createdAt"`)}

      UNION ALL
      SELECT item_return.id, item_return."orderId", ${Kind.RETURN_RECEIVED}::text, item_return."receivedAt", NULL, NULL, FALSE
      FROM "order_returns" AS item_return CROSS JOIN report_period
      WHERE item_return.status = 'RECEIVED' AND ${within(Prisma.sql`item_return."receivedAt"`)}

      UNION ALL
      SELECT refund.id, payment."orderId", ${Kind.REFUND_ADJUSTMENT}::text, refund."confirmedAt", refund."amountToman", refund."providerSnapshot", FALSE
      FROM "payment_refunds" AS refund
      JOIN "payments" AS payment ON payment.id = refund."paymentId"
      CROSS JOIN report_period
      WHERE refund.status = 'CONFIRMED' AND ${within(Prisma.sql`refund."confirmedAt"`)}

      UNION ALL
      SELECT cost.id, cost."orderId",
        CASE cost.type WHEN 'PAYMENT_GATEWAY_FEE' THEN ${Kind.PAYMENT_CHANNEL_FEE}::text ELSE ${Kind.SHIPPING_PROVIDER_COST}::text END,
        cost."occurredAt", cost."amountToman", NULL, FALSE
      FROM "order_cost_entries" AS cost CROSS JOIN report_period
      WHERE cost.type IN ('PAYMENT_GATEWAY_FEE', 'SHIPPING_PROVIDER') AND ${within(Prisma.sql`cost."occurredAt"`)}
    ), attributed AS (
      SELECT
        activity.kind || ':' || activity."entityId"::text AS "eventId",
        activity."orderId", activity.kind, activity."occurredAt", activity.provider,
        activity."awaitingReview" AND orders.status = 'PENDING_PAYMENT' AS "awaitingReview",
        attribution.source, attribution.medium, attribution.campaign, attribution."campaignId", attribution.content,
        CASE WHEN activity.kind = ${Kind.PURCHASE_CONFIRMED} THEN COALESCE(finance."customerTotalToman", activity.amount) ELSE activity.amount END AS "amountToman",
        CASE WHEN activity.kind = ${Kind.PURCHASE_CONFIRMED} THEN COALESCE(finance."merchandiseRevenueToman", orders."merchandiseTotalToman") END AS "merchandiseToman",
        CASE WHEN activity.kind = ${Kind.PURCHASE_CONFIRMED} THEN COALESCE(finance."platingRevenueToman", orders."platingTotalToman") END AS "platingToman",
        CASE WHEN activity.kind = ${Kind.PURCHASE_CONFIRMED} THEN COALESCE(finance."discountToman", orders."discountTotalToman") END AS "orderDiscountToman",
        finance."walletAppliedToman",
        CASE WHEN price_quote."campaignId" IS NOT NULL THEN price_quote."merchandiseDiscountToman" + price_quote."shippingDiscountToman" END AS "campaignDiscountToman",
        CASE WHEN activity.kind = ${Kind.PURCHASE_CONFIRMED} THEN COALESCE(finance."shippingChargedToman", orders."shippingTotalToman") END AS "shippingChargedToman",
        CASE WHEN activity.kind = ${Kind.PURCHASE_CONFIRMED} THEN COALESCE(finance."taxToman", orders."taxTotalToman") END AS "taxToman",
        activity.kind = ${Kind.PURCHASE_CONFIRMED} AND finance."orderId" IS NULL AS "missingFinanceSnapshot"
      FROM activity
      JOIN "orders" AS orders ON orders.id = activity."orderId"
      LEFT JOIN "order_finance_snapshots" AS finance ON finance."orderId" = orders.id AND activity.kind = ${Kind.PURCHASE_CONFIRMED}
      LEFT JOIN "order_price_quotes" AS price_quote ON price_quote."orderId" = orders.id AND activity.kind = ${Kind.PURCHASE_CONFIRMED}
      LEFT JOIN "order_attributions" AS attribution ON attribution."orderId" = orders.id
      WHERE TRUE ${source} ${medium} ${campaign} ${catalog} ${device}
    )
  `;
}
