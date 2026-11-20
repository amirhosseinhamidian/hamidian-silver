import { BadRequestException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import type { PrismaService } from '../../infrastructure/database/prisma.service';

export type CatalogVariantFilter = Readonly<{
  sizeId?: string;
  minLengthMm?: number;
  maxLengthMm?: number;
}>;

type VariantStockRow = {
  productId: string;
  id: string;
  sizeId: string | null;
  lengthMm: number | null;
  availableQuantity: bigint;
  isComposite: boolean;
};

export type MatchingCatalogVariants = {
  availableQuantity: number;
  variants: {
    id: string;
    sizeId: string | null;
    lengthMm: number | null;
    availableQuantity: number;
  }[];
};

export const catalogStockCte = Prisma.sql`stock AS (
      SELECT inventory."variantId", SUM(GREATEST(inventory."onHand" - inventory."reserved", 0)) AS units
      FROM "inventory" AS inventory
      JOIN "warehouses" AS warehouse ON warehouse.id = inventory."warehouseId"
      WHERE warehouse."isActive" AND warehouse."deletedAt" IS NULL
      GROUP BY inventory."variantId"
)`;
export const catalogVariantStockSql = Prisma.sql`CASE WHEN variant."inventoryMode" = 'COMPONENTS' THEN COALESCE((
          SELECT MIN(CASE
            WHEN component."isActive" AND component."deletedAt" IS NULL AND component."inventoryMode" = 'OWN' AND recipe.quantity > 0
            THEN FLOOR(COALESCE(component_stock.units, 0)::numeric / NULLIF(recipe.quantity, 0))
            ELSE 0
          END)
          FROM "product_variant_components" AS recipe
          JOIN "product_variants" AS component ON component.id = recipe."componentVariantId"
          LEFT JOIN stock AS component_stock ON component_stock."variantId" = component.id
          WHERE recipe."bundleVariantId" = variant.id
        ), 0) ELSE COALESCE(own_stock.units, 0) END::bigint`;
export const catalogVariantStockJoins = Prisma.sql`LEFT JOIN stock AS own_stock ON own_stock."variantId" = variant.id
      LEFT JOIN "sizes" AS size ON size.id = variant."sizeId"
      LEFT JOIN "size_groups" AS size_group ON size_group.id = size."groupId"`;
export const catalogActiveVariantCriteria = Prisma.sql`AND variant."isActive" AND variant."deletedAt" IS NULL
        AND (product."sizeMode" <> 'SIZED' OR
          (size."isActive" AND size."deletedAt" IS NULL AND size_group."isActive" AND size_group."deletedAt" IS NULL))`;

export const catalogProductStockSql = Prisma.sql`COALESCE((
  SELECT CASE WHEN product."purchaseMode" = 'COMPOSITE' THEN MAX(stock_amount.quantity) ELSE SUM(stock_amount.quantity) END
  FROM "product_variants" AS variant
  ${catalogVariantStockJoins}
  CROSS JOIN LATERAL (SELECT ${catalogVariantStockSql} AS quantity) AS stock_amount
  WHERE variant."productId" = product.id ${catalogActiveVariantCriteria}
), 0)::bigint`;

export async function readMatchingCatalogVariants(
  prisma: Pick<PrismaService, '$queryRaw'>,
  { sizeId, minLengthMm, maxLengthMm }: CatalogVariantFilter,
) {
  if (sizeId === undefined && minLengthMm === undefined && maxLengthMm === undefined) {
    return undefined;
  }
  if (minLengthMm !== undefined && maxLengthMm !== undefined && minLengthMm > maxLengthMm) {
    throw new BadRequestException('Minimum variant length must not exceed maximum variant length.');
  }
  const rows = await prisma.$queryRaw<VariantStockRow[]>(Prisma.sql`
    WITH ${catalogStockCte},
    candidates AS (
      SELECT
        variant."productId", variant.id, variant."sizeId", variant."lengthMm",
        product."purchaseMode" = 'COMPOSITE' AS "isComposite",
        ${catalogVariantStockSql} AS "availableQuantity"
      FROM "product_variants" AS variant
      JOIN "products" AS product ON product.id = variant."productId"
      ${catalogVariantStockJoins}
      WHERE product.status = 'ACTIVE' AND product."deletedAt" IS NULL
        ${catalogActiveVariantCriteria}
        ${sizeId === undefined ? Prisma.empty : Prisma.sql`AND variant."sizeId" = ${sizeId}::uuid`}
        ${minLengthMm === undefined ? Prisma.empty : Prisma.sql`AND variant."lengthMm" >= ${minLengthMm}`}
        ${maxLengthMm === undefined ? Prisma.empty : Prisma.sql`AND variant."lengthMm" <= ${maxLengthMm}`}
    )
    SELECT * FROM candidates WHERE "availableQuantity" > 0 ORDER BY id
  `);
  const matches = new Map<string, MatchingCatalogVariants>();
  for (const { productId, isComposite, availableQuantity, ...variant } of rows) {
    const match = matches.get(productId) ?? { availableQuantity: 0, variants: [] };
    const quantity = Number(availableQuantity);
    match.availableQuantity = isComposite
      ? Math.max(match.availableQuantity, quantity)
      : match.availableQuantity + quantity;
    match.variants.push({ ...variant, availableQuantity: quantity });
    matches.set(productId, match);
  }
  return matches;
}
