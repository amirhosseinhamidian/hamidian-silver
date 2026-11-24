import { BadRequestException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { catalogCategorySubtreeCte } from './catalog-category-counts';
import {
  catalogAttributeFacetCountsCtes,
  catalogFacetAttributesCtes,
} from './catalog-facet-attributes';
import { catalogRankingSql } from './catalog-ranking';
import {
  catalogActiveVariantCriteria,
  buildCatalogStockCte,
  catalogVariantStockJoins,
  buildCatalogVariantStockSql,
  type MatchingCatalogVariants,
} from './catalog-variant-filter';
import {
  PublicCatalogAvailability,
  type PublicCatalogFacetsDto,
  type PublicCatalogFacetsQueryDto,
} from './dto/public-catalog-facets.dto';

export type CatalogFacetPageRow = {
  total: bigint;
  items: {
    id: string;
    availableQuantity: number;
    salePriceToman: number | null;
    compareAtPriceToman: number | null;
    variants: MatchingCatalogVariants['variants'];
  }[];
  facets: PublicCatalogFacetsDto;
  invalidAttributeFilter: string | null;
  qualifiedSales: boolean;
};

export type CampaignCollectionSelection = Readonly<{
  allProducts: boolean;
  productIds: readonly string[];
  categoryIds: readonly string[];
  manualProductIds?: readonly string[];
  minimumQuantity: number;
  includeFilterOptions?: boolean;
}>;

export function buildPublicCatalogFacetsQuery(
  query: PublicCatalogFacetsQueryDto,
  searchMatches?: Prisma.Sql,
  collection?: CampaignCollectionSelection,
): Prisma.Sql {
  const attributes = (query.attributes ?? []).map(({ code, values, min, max }) => ({
    code,
    choices: values ?? null,
    minimum: min ?? null,
    maximum: max ?? null,
  }));
  const categories = query.categories ?? [];
  const brands = query.brands ?? [];
  const sizes = query.sizeIds ?? [];
  const scopeCategory = query.scopeCategory ?? null;
  const scopeBrand = query.scopeBrand ?? null;
  const scopeCountry = query.scopeCountry ?? null;
  const priceActive = query.minPriceToman != null || query.maxPriceToman != null;
  const weightActive = query.minWeightGrams != null || query.maxWeightGrams != null;
  const lengthActive = query.minLengthMm != null || query.maxLengthMm != null;
  const blocks = [
    { scope: 'categories', active: categories.length > 0 },
    { scope: 'brands', active: brands.length > 0 },
    { scope: 'sizes', active: sizes.length > 0 },
    { scope: 'price', active: priceActive },
    { scope: 'weight', active: weightActive },
    { scope: 'length', active: lengthActive },
    { scope: 'availability', active: query.availability != null },
  ];
  const contexts = collection
    ? ['results']
    : [
        'results',
        ...blocks.filter(({ active }) => active).map(({ scope }) => scope),
        ...attributes.map(({ code }) => `attribute:${code}`),
      ];
  const facetScope = (scope: string) => (contexts.includes(scope) ? scope : 'results');
  const invalidRange = (min: number | null | undefined, max: number | null | undefined) =>
    min != null && max != null && min > max;
  if (
    invalidRange(query.minPriceToman, query.maxPriceToman) ||
    invalidRange(query.minWeightGrams, query.maxWeightGrams) ||
    invalidRange(query.minLengthMm, query.maxLengthMm) ||
    attributes.some(
      ({ choices, minimum, maximum }) =>
        invalidRange(minimum, maximum) ||
        (choices === null
          ? minimum === null && maximum === null
          : minimum !== null || maximum !== null),
    ) ||
    new Set(attributes.map(({ code }) => code)).size !== attributes.length ||
    [query.q, scopeCategory, scopeBrand, scopeCountry, ...categories, ...brands].some((item) =>
      item?.includes('\0'),
    )
  ) {
    throw new BadRequestException(
      'Catalog facet filters must have unique attributes and valid ranges.',
    );
  }
  const withinPageCategory = (categoryId: Prisma.Sql) =>
    scopeCategory
      ? Prisma.sql`EXISTS (
          SELECT 1 FROM subtree scope_relation
          JOIN "categories" scope_root ON scope_root.id = scope_relation."rootId"
          WHERE scope_relation."categoryId" = ${categoryId} AND scope_root.slug = ${scopeCategory}
        )`
      : Prisma.sql`TRUE`;
  const lowerBound = (column: Prisma.Sql, bound: number | undefined) =>
    bound == null ? Prisma.sql`TRUE` : Prisma.sql`${column} >= ${bound}::numeric`;
  const upperBound = (column: Prisma.Sql, bound: number | undefined) =>
    bound == null ? Prisma.sql`TRUE` : Prisma.sql`${column} <= ${bound}::numeric`;
  const ranking = catalogRankingSql(query.sort);
  const range = (scope: string, column: Prisma.Sql) => Prisma.sql`
    (SELECT CASE WHEN COUNT(*) = 0 THEN NULL ELSE jsonb_build_object(
       'min', MIN(${column}), 'max', MAX(${column}), 'count', COUNT(DISTINCT p.id)
     ) END FROM eligible_products p
     JOIN selected_variants v ON v.scope = p.scope AND v."productId" = p.id
     WHERE p.scope = ${facetScope(scope)} AND ${column} IS NOT NULL)
  `;
  const pageSize = query.pageSize ?? 24;
  const page = query.page ?? 1;
  const hasVariantFilter = sizes.length > 0 || priceActive || weightActive || lengthActive;
  const checkoutStockOnly = query.checkoutStockOnly === true || Boolean(collection);
  const uuidArray = (ids: readonly string[]) =>
    ids.length ? Prisma.sql`ARRAY[${Prisma.join(ids)}]::uuid[]` : Prisma.sql`ARRAY[]::uuid[]`;
  const manualOrder = collection?.manualProductIds
    ? Prisma.sql`array_position(${uuidArray(collection.manualProductIds)}, p.id),`
    : Prisma.empty;
  const categoryAndBrandFacets = Prisma.sql`
    'categories', COALESCE((SELECT jsonb_agg(to_jsonb(o) ORDER BY o.count DESC, o.value) FROM category_facets o), '[]'::jsonb),
    'brands', COALESCE((SELECT jsonb_agg(to_jsonb(o) ORDER BY o.count DESC, o.value) FROM brand_facets o), '[]'::jsonb)
  `;
  return Prisma.sql`
    WITH RECURSIVE ${catalogCategorySubtreeCte},
    ${
      searchMatches
        ? Prisma.sql`${searchMatches}, ranked_matches AS (
      SELECT "productId", MAX(score) AS score FROM search_matches GROUP BY "productId"
    ),`
        : Prisma.empty
    }
    requested_attributes AS (
      SELECT * FROM jsonb_to_recordset(${JSON.stringify(attributes)}::jsonb)
      AS filters(code text, choices jsonb, minimum numeric, maximum numeric)
    ),
    scoped_products AS MATERIALIZED (
      SELECT product.id, product.name, product."createdAt", product."purchaseMode",
        product."sizeMode", product."salePriceToman", product."compareAtPriceToman",
        brand.slug AS "brandSlug", brand.name AS "brandLabel",
        ${searchMatches ? Prisma.sql`ranked_matches.score` : Prisma.sql`0`} AS score,
        ${
          categories.length
            ? Prisma.sql`EXISTS (
          SELECT 1 FROM "product_categories" membership
          JOIN subtree relation ON relation."categoryId" = membership."categoryId"
          JOIN "categories" root ON root.id = relation."rootId"
          WHERE membership."productId" = product.id AND root.slug IN (${Prisma.join(categories)})
            AND ${withinPageCategory(Prisma.sql`root.id`)}
        )`
            : Prisma.sql`TRUE`
        } AS "categoryMatches",
        ${brands.length ? Prisma.sql`brand.slug IN (${Prisma.join(brands)})` : Prisma.sql`TRUE`} AS "brandMatches"
      FROM "products" product
      ${searchMatches ? Prisma.sql`JOIN ranked_matches ON ranked_matches."productId" = product.id` : Prisma.empty}
      LEFT JOIN "brands" brand ON brand.id = product."brandId" AND brand."isActive" AND brand."deletedAt" IS NULL
      WHERE product.status = 'ACTIVE' AND product."deletedAt" IS NULL
        ${
          collection?.manualProductIds
            ? Prisma.sql`AND product.id = ANY(${uuidArray(collection.manualProductIds)})`
            : Prisma.empty
        }
        ${
          collection && !collection.allProducts
            ? Prisma.sql`AND (product.id = ANY(${uuidArray(collection.productIds)}) OR EXISTS (
              SELECT 1 FROM "product_categories" membership
              JOIN "categories" scoped_category ON scoped_category.id = membership."categoryId"
              WHERE membership."productId" = product.id AND scoped_category."isActive"
                AND scoped_category."deletedAt" IS NULL
                AND membership."categoryId" = ANY(${uuidArray(collection.categoryIds)})
            ))`
            : Prisma.empty
        }
        ${scopeBrand ? Prisma.sql`AND brand.slug = ${scopeBrand}` : Prisma.empty}
        ${
          scopeCountry
            ? Prisma.sql`AND EXISTS (
          SELECT 1 FROM "countries" country WHERE country.id = product."countryId"
            AND country.slug = ${scopeCountry} AND country."isActive" AND country."deletedAt" IS NULL
        )`
            : Prisma.empty
        }
        ${
          scopeCategory
            ? Prisma.sql`AND EXISTS (
          SELECT 1 FROM "product_categories" membership
          WHERE membership."productId" = product.id
            AND ${withinPageCategory(Prisma.sql`membership."categoryId"`)}
        )`
            : Prisma.empty
        }
    ),
    ${catalogFacetAttributesCtes},
    contexts(scope) AS (VALUES ${Prisma.join(contexts.map((name) => Prisma.sql`(${name}::text)`))}),
    product_contexts AS MATERIALIZED (
      SELECT scope, product.*
      FROM product_requirements product CROSS JOIN contexts
      WHERE (scope = 'categories' OR product."categoryMatches")
        AND (scope = 'brands' OR product."brandMatches")
        AND NOT EXISTS (
          SELECT 1 FROM unnest(product."missingAttributes") attr(code)
          WHERE scope <> ('attribute:' || attr.code)
        )
    ),
    ${buildCatalogStockCte(checkoutStockOnly)},
    variant_candidates AS MATERIALIZED (
      SELECT variant.id, variant."productId",
        CASE WHEN size."isActive" AND size."deletedAt" IS NULL AND size_group."isActive"
          AND size_group."deletedAt" IS NULL THEN size.id END AS "sizeId",
        CASE WHEN variant."lengthMm" > 0 THEN variant."lengthMm" END AS "lengthMm",
        CASE WHEN variant."weightGrams" > 0 THEN variant."weightGrams" END AS "weightGrams",
        CASE WHEN COALESCE(variant."salePriceToman", product."salePriceToman") > 0
          THEN COALESCE(variant."salePriceToman", product."salePriceToman") END AS "salePriceToman",
        COALESCE(variant."compareAtPriceToman", product."compareAtPriceToman") AS "compareAtPriceToman",
        ${buildCatalogVariantStockSql(checkoutStockOnly)} AS quantity
      FROM scoped_products product
      JOIN "product_variants" variant ON variant."productId" = product.id
      ${catalogVariantStockJoins}
      WHERE EXISTS (SELECT 1 FROM product_contexts context WHERE context.id = product.id)
        ${catalogActiveVariantCriteria}
    ),
    selected_variants AS MATERIALIZED (
      SELECT product.scope, variant.*
      FROM product_contexts product
      JOIN variant_candidates variant ON variant."productId" = product.id
      WHERE variant.quantity > 0
        ${
          sizes.length
            ? Prisma.sql`
          AND (product.scope = 'sizes' OR variant."sizeId" IN (
            ${Prisma.join(sizes.map((size) => Prisma.sql`${size}::uuid`))}
          ))`
            : Prisma.empty
        }
        ${
          priceActive
            ? Prisma.sql`AND (product.scope = 'price' OR (
          ${lowerBound(Prisma.sql`variant."salePriceToman"`, query.minPriceToman)}
          AND ${upperBound(Prisma.sql`variant."salePriceToman"`, query.maxPriceToman)}
        ))`
            : Prisma.empty
        }
        ${
          weightActive
            ? Prisma.sql`AND (product.scope = 'weight' OR (
          ${lowerBound(Prisma.sql`variant."weightGrams"`, query.minWeightGrams)}
          AND ${upperBound(Prisma.sql`variant."weightGrams"`, query.maxWeightGrams)}
        ))`
            : Prisma.empty
        }
        ${
          lengthActive
            ? Prisma.sql`AND (product.scope = 'length' OR (
          ${lowerBound(Prisma.sql`variant."lengthMm"`, query.minLengthMm)}
          AND ${upperBound(Prisma.sql`variant."lengthMm"`, query.maxLengthMm)}
        ))`
            : Prisma.empty
        }
    ),
    variant_totals AS (
      SELECT scope, "productId", SUM(quantity) AS units, MAX(quantity) AS bundle_units,
        MIN("salePriceToman") AS price
      FROM selected_variants GROUP BY scope, "productId"
    ),
    eligible_products AS MATERIALIZED (
      SELECT p.scope, p.id, p.name, p."createdAt", p.score, p."brandSlug", p."brandLabel",
        v.price AS "salePriceToman",
        COALESCE(CASE WHEN p."purchaseMode" = 'COMPOSITE' THEN v.bundle_units ELSE v.units END, 0)
          AS "availableQuantity"
      FROM product_contexts p
      LEFT JOIN variant_totals v ON v.scope = p.scope AND v."productId" = p.id
      WHERE (
        v."productId" IS NOT NULL OR NOT (
          (${sizes.length > 0} AND p.scope <> 'sizes') OR
          (${priceActive} AND p.scope <> 'price') OR
          (${weightActive} AND p.scope <> 'weight') OR
          (${lengthActive} AND p.scope <> 'length')
        )
      )
      ${
        query.availability
          ? Prisma.sql`AND (
        p.scope = 'availability' OR ((v."productId" IS NOT NULL) =
          ${query.availability === PublicCatalogAvailability.IN_STOCK})
      )`
          : Prisma.empty
      }
      ${
        collection
          ? Prisma.sql`AND v.price IS NOT NULL
            AND (CASE WHEN p."purchaseMode" = 'COMPOSITE' THEN v.bundle_units ELSE v.units END) >= ${collection.minimumQuantity}`
          : Prisma.empty
      }
    ),
    ${ranking.ctes}
    result_page AS (
      SELECT p.*, row_number() OVER (ORDER BY ${manualOrder} ${ranking.order}) AS position
      FROM eligible_products p ${ranking.join} WHERE p.scope = 'results'
      ORDER BY position LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}
    ),
    -- Keep facet CTE names distinct from tables read by the recursive query.
    brand_facets AS (
      SELECT p."brandSlug" AS value, p."brandLabel" AS label, COUNT(*) AS count
      FROM eligible_products p WHERE p.scope = ${facetScope('brands')} AND p."brandSlug" IS NOT NULL
      GROUP BY p."brandSlug", p."brandLabel"
    ),
    category_facets AS (
      SELECT cat.slug AS value, cat.name AS label, COUNT(DISTINCT p.id) AS count
      FROM eligible_products p JOIN "product_categories" membership ON membership."productId" = p.id
      JOIN subtree relation ON relation."categoryId" = membership."categoryId"
      JOIN "categories" cat ON cat.id = relation."rootId"
      WHERE p.scope = ${facetScope('categories')} AND ${withinPageCategory(Prisma.sql`cat.id`)}
      GROUP BY cat.slug, cat.name
    ),
    size_facets AS (
      SELECT size.id::text AS value, size.label, COUNT(DISTINCT p.id) AS count
      FROM eligible_products p
      JOIN selected_variants v ON v.scope = p.scope AND v."productId" = p.id
      JOIN "sizes" size ON size.id = v."sizeId"
      WHERE p.scope = ${facetScope('sizes')}
      GROUP BY size.id, size.label
    ),
    availability_facets AS (
      SELECT CASE WHEN p."availableQuantity" > 0 THEN 'in-stock' ELSE 'out-of-stock' END AS value,
        CASE WHEN p."availableQuantity" > 0 THEN 'موجود' ELSE 'ناموجود' END AS label, COUNT(*) AS count
      FROM eligible_products p WHERE p.scope = ${facetScope('availability')} GROUP BY 1, 2
    ),
    ${catalogAttributeFacetCountsCtes}
    SELECT (SELECT COUNT(*) FROM eligible_products WHERE scope = 'results') AS total,
      ${ranking.qualifiedSales} AS "qualifiedSales",
      (SELECT code FROM invalid_attribute_filters ORDER BY code LIMIT 1) AS "invalidAttributeFilter",
      COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id', p.id, 'availableQuantity', p."availableQuantity",
        'salePriceToman', p."salePriceToman", 'compareAtPriceToman', price."compareAtPriceToman",
        'variants', ${
          hasVariantFilter
            ? Prisma.sql`
          COALESCE((SELECT jsonb_agg(jsonb_build_object('id', v.id, 'sizeId', v."sizeId",
            'lengthMm', v."lengthMm", 'availableQuantity', v.quantity) ORDER BY v.id)
            FROM selected_variants v WHERE v.scope = 'results' AND v."productId" = p.id), '[]'::jsonb)
        `
            : Prisma.sql`'[]'::jsonb`
        }
      ) ORDER BY p.position)
      FROM result_page p LEFT JOIN LATERAL (
        SELECT v."compareAtPriceToman" FROM selected_variants v
        WHERE v.scope = 'results' AND v."productId" = p.id AND v."salePriceToman" = p."salePriceToman"
        ORDER BY v.id LIMIT 1
      ) price ON TRUE), '[]'::jsonb) AS items,
      ${
        collection
          ? collection.includeFilterOptions
            ? Prisma.sql`jsonb_build_object(${categoryAndBrandFacets})`
            : Prisma.sql`'{}'::jsonb`
          : Prisma.sql`jsonb_build_object(
        ${categoryAndBrandFacets},
        'sizes', COALESCE((SELECT jsonb_agg(to_jsonb(o) ORDER BY o.count DESC, o.value) FROM size_facets o), '[]'::jsonb),
        'availability', COALESCE((SELECT jsonb_agg(to_jsonb(o) ORDER BY o.value) FROM availability_facets o), '[]'::jsonb),
        'priceToman', ${range('price', Prisma.sql`v."salePriceToman"`)},
        'weightGrams', ${range('weight', Prisma.sql`v."weightGrams"`)},
        'lengthMm', ${range('length', Prisma.sql`v."lengthMm"`)},
        'attributes', COALESCE((SELECT facets FROM attribute_facets), '[]'::jsonb)
      )`
      } AS facets
  `;
}
