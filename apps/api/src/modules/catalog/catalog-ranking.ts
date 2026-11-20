import { Prisma } from '../../generated/prisma/client';
import { PublicCatalogSort } from './dto/public-catalog-query.dto';

export const CATALOG_RANKING_VERSION = 1;
const BEST_SELLING_DAYS = 30;
const MINIMUM_BEST_SELLING_ORDERS = 3;

export function isCommercialCatalogSort(
  sort?: PublicCatalogSort,
): sort is
  PublicCatalogSort.AVAILABILITY | PublicCatalogSort.BEST_SELLING | PublicCatalogSort.FEATURED {
  return (
    sort === PublicCatalogSort.AVAILABILITY ||
    sort === PublicCatalogSort.BEST_SELLING ||
    sort === PublicCatalogSort.FEATURED
  );
}

export function catalogRankingSql(sort?: PublicCatalogSort) {
  const stock = Prisma.sql`(p."availableQuantity" > 0) DESC`;
  const newest = Prisma.sql`p.score DESC, p."createdAt" DESC, p.id DESC`;
  let ctes = Prisma.empty;
  let join = Prisma.empty;
  let qualifiedSales = Prisma.sql`FALSE`;
  let order = newest;

  switch (sort) {
    case PublicCatalogSort.PRICE_ASC:
      order = Prisma.sql`p.score DESC, p."salePriceToman" ASC NULLS LAST, p."createdAt" DESC, p.id ASC`;
      break;
    case PublicCatalogSort.PRICE_DESC:
      order = Prisma.sql`p.score DESC, p."salePriceToman" DESC NULLS LAST, p."createdAt" DESC, p.id ASC`;
      break;
    case PublicCatalogSort.NAME_ASC:
      order = Prisma.sql`p.score DESC, p.name ASC, p.id ASC`;
      break;
    case PublicCatalogSort.AVAILABILITY:
      order = Prisma.sql`p."availableQuantity" DESC, ${newest}`;
      break;
    case PublicCatalogSort.BEST_SELLING:
      ctes = Prisma.sql`
        ranking_sales AS (
          SELECT variant."productId", COUNT(DISTINCT confirmed.id) AS orders
          FROM "orders" confirmed
          JOIN "payments" payment ON payment."orderId" = confirmed.id
          JOIN "order_items" line ON line."orderId" = confirmed.id
          JOIN "product_variants" variant ON variant.id = line."variantId"
          JOIN eligible_products eligible ON eligible.id = variant."productId" AND eligible.scope = 'results'
          WHERE confirmed."paidAt" > CURRENT_TIMESTAMP - make_interval(days => ${BEST_SELLING_DAYS}::int)
            AND confirmed."paidAt" <= CURRENT_TIMESTAMP
            AND confirmed.status IN ('PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED')
            AND payment.status IN ('PAID', 'PARTIALLY_REFUNDED')
            AND line.quantity > line."returnedQuantity"
          GROUP BY variant."productId"
          HAVING COUNT(DISTINCT confirmed.id) >= ${MINIMUM_BEST_SELLING_ORDERS}::int
        ),
      `;
      join = Prisma.sql`LEFT JOIN ranking_sales sales ON sales."productId" = p.id`;
      qualifiedSales = Prisma.sql`EXISTS (SELECT 1 FROM ranking_sales)`;
      order = Prisma.sql`sales.orders DESC NULLS LAST, ${newest}`;
      break;
    case PublicCatalogSort.FEATURED:
      join = Prisma.sql`
        LEFT JOIN "catalog_merchandising_entries" merch ON merch."productId" = p.id
          AND merch.enabled AND merch."startsAt" <= CURRENT_TIMESTAMP
          AND merch."endsAt" > CURRENT_TIMESTAMP
      `;
      order = Prisma.sql`COALESCE(merch.pinned, FALSE) DESC, COALESCE(merch.weight, 0) DESC, ${newest}`;
      break;
  }
  return { ctes, join, qualifiedSales, order: Prisma.sql`${stock}, ${order}` };
}
