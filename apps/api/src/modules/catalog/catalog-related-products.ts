import { Prisma } from '../../generated/prisma/client';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import {
  buildCatalogStockCte,
  buildCatalogVariantStockSql,
  catalogActiveVariantCriteria,
  catalogVariantStockJoins,
} from './catalog-variant-filter';

export async function readRelatedProductPage(
  prisma: Pick<PrismaService, '$queryRaw'>,
  product: { id: string; salePriceToman: number | null },
  page: number,
  pageSize: number,
) {
  const order = Prisma.sql`manual_at ASC NULLS LAST, feature_matches DESC, size_matches DESC,
    price_distance ASC NULLS LAST, created_at DESC, id ASC`;
  const offset = BigInt(page - 1) * BigInt(pageSize);
  const rows = await prisma.$queryRaw<{ id: string | null; total: bigint }[]>(Prisma.sql`
    WITH ${buildCatalogStockCte(true)},
    manual AS (
      SELECT CASE WHEN relation."sourceProductId" = ${product.id}::uuid
        THEN relation."targetProductId" ELSE relation."sourceProductId" END AS id,
        MIN(relation."createdAt") AS manual_at
      FROM "product_relations" relation
      WHERE ${product.id}::uuid IN (relation."sourceProductId", relation."targetProductId")
      GROUP BY 1
    ),
    active_categories AS (
      SELECT membership."categoryId"
      FROM "product_categories" membership
      JOIN "categories" category ON category.id = membership."categoryId"
      WHERE membership."productId" = ${product.id}::uuid
        AND category."isActive" AND category."deletedAt" IS NULL
    ),
    source_features AS (
      SELECT DISTINCT ON (feature."attributeCode") feature."attributeCode", feature.value
      FROM "catalog_product_attribute_values" feature
      JOIN "catalog_attribute_definitions" definition ON definition.code = feature."attributeCode"
      JOIN "catalog_attribute_versions" version
        ON version."attributeCode" = definition.code AND version.version = definition."currentVersion"
      WHERE feature."productId" = ${product.id}::uuid AND version."isActive"
      ORDER BY feature."attributeCode", feature.revision DESC
    ),
    source_sizes AS (
      SELECT DISTINCT variant."sizeId"
      FROM "product_variants" variant
      JOIN "products" product ON product.id = variant."productId"
      ${catalogVariantStockJoins}
      WHERE product.id = ${product.id}::uuid AND variant."sizeId" IS NOT NULL
        ${catalogActiveVariantCriteria} AND ${buildCatalogVariantStockSql(true)} > 0
    ),
    candidates AS (
      SELECT product.id, manual.manual_at, product."createdAt" AS created_at,
        ABS(buyable.price - ${product.salePriceToman}::integer) AS price_distance,
        buyable.size_matches,
        (
          SELECT COUNT(*) FROM source_features source
          JOIN LATERAL (
            SELECT feature.value
            FROM "catalog_product_attribute_values" feature
            WHERE feature."productId" = product.id
              AND feature."attributeCode" = source."attributeCode"
            ORDER BY feature.revision DESC LIMIT 1
          ) current_feature ON current_feature.value = source.value
          WHERE source.value IS NOT NULL AND source.value <> 'null'::jsonb
        ) AS feature_matches
      FROM "products" product
      LEFT JOIN manual ON manual.id = product.id
      JOIN LATERAL (
        SELECT MIN(COALESCE(variant."salePriceToman", product."salePriceToman")) AS price,
          COUNT(DISTINCT variant."sizeId") FILTER (
            WHERE variant."sizeId" IN (SELECT "sizeId" FROM source_sizes)
          ) AS size_matches
        FROM "product_variants" variant
        ${catalogVariantStockJoins}
        WHERE variant."productId" = product.id ${catalogActiveVariantCriteria}
          AND ${buildCatalogVariantStockSql(true)} > 0
      ) buyable ON buyable.price IS NOT NULL
      WHERE product.status = 'ACTIVE' AND product."deletedAt" IS NULL
        AND product.id <> ${product.id}::uuid
        AND (manual.id IS NOT NULL OR EXISTS (
          SELECT 1 FROM "product_categories" membership
          JOIN active_categories USING ("categoryId")
          WHERE membership."productId" = product.id
        ))
    )
    SELECT listed.id, totals.total
    FROM (SELECT COUNT(*) AS total FROM candidates) totals
    LEFT JOIN LATERAL (
      SELECT * FROM candidates ORDER BY ${order} LIMIT ${pageSize} OFFSET ${offset}
    ) listed ON true
    ORDER BY ${order}
  `);
  return {
    ids: rows.flatMap(({ id }) => (id === null ? [] : [id])),
    total: Number(rows[0]?.total ?? 0),
  };
}
