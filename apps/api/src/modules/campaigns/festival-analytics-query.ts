import { Prisma, type Campaign } from '../../generated/prisma/client';
import { growthReportPeriodSql } from '../growth-attribution/growth-revenue-events';
import { scopedCampaignOrders } from './campaign-order-scope';
import type { FestivalAnalyticsQueryDto } from './dto/festival-analytics.dto';

function matchesCatalog({ product, category }: FestivalAnalyticsQueryDto) {
  return Prisma.sql`
    ${product ? Prisma.sql`AND product.slug = ${product}` : Prisma.empty}
    ${
      category
        ? Prisma.sql`AND EXISTS (
          SELECT 1 FROM product_categories membership
          JOIN categories category ON category.id = membership."categoryId"
          WHERE membership."productId" = product.id AND category.slug = ${category}
        )`
        : Prisma.empty
    }
  `;
}

function reportGroups(section: FestivalAnalyticsQueryDto['section']) {
  switch (section) {
    case 'categories':
      return Prisma.sql`SELECT * FROM category_groups`;
    case 'brands':
      return Prisma.sql`
        SELECT COALESCE(brand.id::text, '') AS key, COALESCE(brand.name, 'بدون برند') AS label,
          NULL::text AS slug, COUNT(DISTINCT item."orderId") AS orders, SUM(item.quantity) AS units,
          SUM(item.amount) AS "amountToman"
        FROM sold_items item LEFT JOIN brands brand ON brand.id = item."brandId"
        GROUP BY brand.id, brand.name
      `;
    case 'offers':
      return Prisma.sql`
        SELECT offer.kind || '/' || offer.version AS key, offer.kind AS label, NULL::text AS slug,
          COUNT(*) AS orders, NULL::bigint AS units, SUM(offer.amount) AS "amountToman"
        FROM (
          SELECT COALESCE(quote.snapshot->'rule'->>'kind', 'UNKNOWN') AS kind,
            COALESCE(quote.snapshot->'rule'->>'version', '') AS version,
            quote."merchandiseDiscountToman"::bigint + quote."shippingDiscountToman" AS amount
          FROM paid_orders paid JOIN order_price_quotes quote ON quote."orderId" = paid.id
          WHERE paid."discountApplied"
        ) offer GROUP BY offer.kind, offer.version
      `;
    case 'sources':
      return Prisma.sql`SELECT * FROM source_groups`;
    case 'orders':
    case 'quotas':
      return Prisma.sql`SELECT * FROM product_groups WHERE FALSE`;
    default:
      return Prisma.sql`SELECT * FROM product_groups`;
  }
}

export function festivalAnalyticsQuery(
  campaign: Pick<Campaign, 'id' | 'trackingId'>,
  query: FestivalAnalyticsQueryDto,
  page: number,
  pageSize: number,
) {
  const { from, to, category, product, orderState, section } = query;
  const direction = query.sort === 'asc' ? Prisma.sql`ASC` : Prisma.sql`DESC`;
  const groupOrder = Prisma.sql`COALESCE(units, orders) ${direction}, key ASC`;
  const orderSort = Prisma.sql`"occurredAt" ${direction}, id ${direction}`;
  const stateFilter =
    orderState === 'CONFIRMED'
      ? Prisma.sql`AND orders.confirmed`
      : orderState
        ? Prisma.sql`AND orders.state = ${orderState}`
        : Prisma.empty;
  // The product/category filters select orders containing a matching line.
  // Order totals remain whole-order amounts, while the product breakdown uses only matching lines.
  const catalogFilter = matchesCatalog(query);
  const includeFunnel = !category && !product && !orderState;
  return Prisma.sql`
    ${scopedCampaignOrders(campaign)},
    report_period AS (${growthReportPeriodSql(query)}),
    candidates AS MATERIALIZED (
      SELECT orders.*, COALESCE(orders."paidAt", orders."createdAt") AS "occurredAt"
      FROM classified orders CROSS JOIN report_period period
      WHERE (
        (orders."createdAt" >= period.starts_at AND orders."createdAt" < period.ends_before)
        OR (orders."paidAt" >= period.starts_at AND orders."paidAt" < period.ends_before)
      )
      ${stateFilter}
      ${
        product || category
          ? Prisma.sql`AND EXISTS (
            SELECT 1 FROM order_items item
            JOIN product_variants variant ON variant.id = item."variantId"
            JOIN products product ON product.id = variant."productId"
            WHERE item."orderId" = orders.id
              AND (NOT orders."discountApplied" OR item."campaignIdSnapshot" = ${campaign.id}::uuid)
              ${catalogFilter}
          )`
          : Prisma.empty
      }
    ),
    selected AS MATERIALIZED (
      SELECT orders.* FROM candidates orders CROSS JOIN report_period period
      WHERE orders."occurredAt" >= period.starts_at AND orders."occurredAt" < period.ends_before
    ),
    paid_orders AS MATERIALIZED (
      SELECT orders.*, COALESCE(finance."customerTotalToman", orders."amountToman") AS collected
      FROM selected orders
      LEFT JOIN order_finance_snapshots finance ON finance."orderId" = orders.id
      WHERE orders.confirmed
    ),
    sold_items AS MATERIALIZED (
      SELECT item."orderId", item.quantity, item."unitSalePriceToman"::bigint * item.quantity AS amount,
        product.id AS "productId", product.name, product.slug, product."brandId"
      FROM paid_orders paid JOIN order_items item ON item."orderId" = paid.id
      JOIN product_variants variant ON variant.id = item."variantId"
      JOIN products product ON product.id = variant."productId"
      WHERE (NOT paid."discountApplied" OR item."campaignIdSnapshot" = ${campaign.id}::uuid)
      ${catalogFilter}
    ),
    product_groups AS (
      SELECT "productId"::text AS key, name AS label, slug, COUNT(DISTINCT "orderId") AS orders,
        SUM(quantity) AS units, SUM(amount) AS "amountToman"
      FROM sold_items GROUP BY "productId", name, slug
    ),
    category_groups AS (
      SELECT category.id::text AS key, category.name AS label, category.slug,
        COUNT(DISTINCT item."orderId") AS orders, SUM(item.quantity) AS units,
        SUM(item.amount) AS "amountToman"
      FROM sold_items item JOIN product_categories membership ON membership."productId" = item."productId"
      JOIN categories category ON category.id = membership."categoryId"
      ${category ? Prisma.sql`WHERE category.slug = ${category}` : Prisma.empty}
      GROUP BY category.id
    ),
    source_groups AS (
      SELECT jsonb_build_array(attribution.source, attribution.medium)::text AS key,
        concat_ws(' / ', attribution.source, attribution.medium) AS label, NULL::text AS slug,
        COUNT(*) AS orders, NULL::bigint AS units, SUM(paid.collected) AS "amountToman"
      FROM paid_orders paid JOIN order_attributions attribution ON attribution."orderId" = paid.id
      WHERE attribution."campaignId" = ${campaign.trackingId}
      GROUP BY attribution.source, attribution.medium
    ),
    daily_sales AS (
      SELECT ("paidAt" AT TIME ZONE 'Asia/Tehran')::date AS day,
        COUNT(*) AS "confirmedOrders", SUM(collected) AS "collectedToman"
      FROM paid_orders GROUP BY 1
    ),
    calendar AS (
      SELECT ${from}::date + i AS day FROM generate_series(0, ${to}::date - ${from}::date) d(i)
    ),
    group_candidates AS (${reportGroups(section)}),
    page_groups AS (
      SELECT * FROM group_candidates
      ORDER BY ${groupOrder} LIMIT ${pageSize + 1} OFFSET ${(page - 1) * pageSize}
    ),
    order_page AS (
      SELECT orders.id, orders.number, orders."occurredAt", orders.state, paid.collected AS "collectedToman"
      FROM selected orders LEFT JOIN paid_orders paid ON paid.id = orders.id
      WHERE ${section === 'orders'}
      ORDER BY ${orderSort} LIMIT ${pageSize + 1} OFFSET ${(page - 1) * pageSize}
    ),
    funnel AS (
      SELECT COUNT(DISTINCT "visitId") AS visits,
        COUNT(DISTINCT "visitId") FILTER (WHERE stage = 'view_item_list') AS "listVisits",
        COUNT(DISTINCT "visitId") FILTER (WHERE stage = 'view_item') AS "itemVisits",
        COUNT(DISTINCT "visitId") FILTER (WHERE stage = 'add_to_cart') AS "cartVisits",
        COUNT(DISTINCT "visitId") FILTER (WHERE stage = 'begin_checkout') AS "checkoutVisits"
      FROM growth_funnel_events event
      JOIN campaign_link_identities identity ON identity.id = event."campaignId" AND identity.campaign = event.campaign
      CROSS JOIN report_period period
      WHERE ${includeFunnel} AND identity.id = ${campaign.trackingId}
        AND event."recordedAt" >= period.starts_at AND event."recordedAt" < period.ends_before
    )
    SELECT (SELECT COUNT(*) FROM selected) AS orders,
      (SELECT COUNT(*) FROM paid_orders) AS "confirmedOrders",
      (SELECT COALESCE(SUM(quantity), 0) FROM sold_items) AS units,
      (SELECT COALESCE(SUM(collected), 0) FROM paid_orders) AS "collectedToman",
      (SELECT COALESCE(SUM(quote."merchandiseDiscountToman"::bigint + quote."shippingDiscountToman"), 0)::bigint
        FROM paid_orders paid JOIN order_price_quotes quote ON quote."orderId" = paid.id
        WHERE paid."discountApplied") AS "discountToman",
      (SELECT COUNT(*) FROM candidates CROSS JOIN report_period
        WHERE "createdAt" >= starts_at AND "createdAt" < ends_before) AS "startedOrders",
      (SELECT COUNT(*) FROM candidates CROSS JOIN report_period
        WHERE "createdAt" >= starts_at AND "createdAt" < ends_before AND "paidAt" < ends_before) AS "confirmedStarts",
      (SELECT jsonb_agg(jsonb_build_object('day', calendar.day::text,
        'confirmedOrders', COALESCE(daily."confirmedOrders", 0),
        'collectedToman', COALESCE(daily."collectedToman", 0)) ORDER BY calendar.day)
        FROM calendar LEFT JOIN daily_sales daily USING (day)) AS daily,
      COALESCE((SELECT jsonb_agg(top ORDER BY units DESC, key) FROM
        (SELECT * FROM product_groups ORDER BY units DESC, key LIMIT 6) top), '[]'::jsonb) AS "topProducts",
      COALESCE((SELECT jsonb_agg(top ORDER BY units DESC, key) FROM
        (SELECT * FROM category_groups ORDER BY units DESC, key LIMIT 6) top), '[]'::jsonb) AS "topCategories",
      COALESCE((SELECT jsonb_agg(top ORDER BY orders DESC, key) FROM
        (SELECT * FROM source_groups ORDER BY orders DESC, key LIMIT 6) top), '[]'::jsonb) AS "topSources",
      COALESCE((SELECT jsonb_agg(page_groups ORDER BY ${groupOrder}) FROM page_groups), '[]'::jsonb) AS "groups",
      COALESCE((SELECT jsonb_agg(order_page ORDER BY ${orderSort}) FROM order_page), '[]'::jsonb) AS "orderItems",
      COALESCE((SELECT jsonb_agg(states ORDER BY state) FROM
        (SELECT state, COUNT(*) AS orders FROM selected GROUP BY state) states), '[]'::jsonb) AS states,
      (SELECT to_jsonb(funnel) FROM funnel WHERE visits > 0) AS funnel
  `;
}
