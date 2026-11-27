import { Prisma } from '../../generated/prisma/client';
import { catalogCategorySubtreeCte } from './catalog-category-counts';
import { catalogAttributeValuesCtes } from './catalog-facet-attributes';
import { catalogSearchTerms } from './catalog-search';

function searchTermsCte(search: string) {
  const terms = catalogSearchTerms(search);
  return Prisma.sql`search_query(value, prefix_pattern, contains_pattern, fuzzy, penalty) AS (
    ${
      terms.length
        ? Prisma.sql`VALUES ${Prisma.join(
            terms.map((term) => {
              const literal = term.replace(/[\\%_]/g, (character) => `\\${character}`);
              return Prisma.sql`(${term}::text, ${`${literal}%`}::text, ${`%${literal}%`}::text,
            ${term.length >= 3 && /\p{L}/u.test(term)}::boolean, ${term === search ? 0 : 0.4}::double precision)`;
            }),
          )}`
        : Prisma.sql`SELECT NULL::text, NULL::text, NULL::text, FALSE, 0::double precision WHERE FALSE`
    }
  )`;
}

function textMatches(field: Prisma.Sql) {
  return Prisma.sql`(
    ${field} LIKE search_query.prefix_pattern OR
    (length(search_query.value) >= 3 AND ${field} LIKE search_query.contains_pattern) OR
    (search_query.fuzzy AND ${field} % search_query.value)
  )`;
}

function score(field: Prisma.Sql, weight: number) {
  return Prisma.sql`(${weight}::double precision
    + CASE WHEN ${field} = search_query.value THEN 6
           WHEN ${field} LIKE search_query.prefix_pattern THEN 4
           WHEN ${field} LIKE search_query.contains_pattern THEN 2
           ELSE 0 END
    + similarity(${field}, search_query.value) - search_query.penalty)`;
}

function productField(
  field: Prisma.Sql,
  weight: number,
  joins = Prisma.empty,
  predicate = Prisma.empty,
) {
  return Prisma.sql`
    SELECT product.id AS "productId", ${score(field, weight)} AS score
    FROM "products" product
    ${joins}
    CROSS JOIN search_query
    WHERE product.status = 'ACTIVE' AND product."deletedAt" IS NULL
      ${predicate}
      AND ${textMatches(field)}
  `;
}

export function publicSearchMatchesSql(search: string) {
  const brandJoin = Prisma.sql`JOIN "brands" brand ON brand.id = product."brandId"
    AND brand."isActive" AND brand."deletedAt" IS NULL`;
  const categoryJoin = Prisma.sql`JOIN "product_categories" membership ON membership."productId" = product.id
    JOIN "categories" category ON category.id = membership."categoryId"
      AND category."isActive" AND category."deletedAt" IS NULL`;
  return Prisma.sql`
    ${searchTermsCte(search)},
    search_matches AS (
      ${productField(Prisma.sql`normalize_fa_search(product.name)`, 12)}
      UNION ALL
      ${productField(Prisma.sql`normalize_fa_search(product.slug)`, 10)}
      UNION ALL
      ${productField(Prisma.sql`normalize_fa_search(product."shortDescription")`, 2)}
      UNION ALL
      ${productField(Prisma.sql`normalize_fa_search(brand.name)`, 6, brandJoin)}
      UNION ALL
      ${productField(Prisma.sql`normalize_fa_search(brand.slug)`, 5, brandJoin)}
      UNION ALL
      ${productField(Prisma.sql`normalize_fa_search(category.name)`, 5, categoryJoin)}
      UNION ALL
      ${productField(Prisma.sql`normalize_fa_search(category.slug)`, 4, categoryJoin)}
      UNION ALL
      ${productField(
        Prisma.sql`normalize_fa_search(variant.sku)`,
        9,
        Prisma.sql`JOIN "product_variants" variant ON variant."productId" = product.id`,
        Prisma.sql`AND variant."isActive" AND variant."deletedAt" IS NULL`,
      )}
      UNION ALL
      SELECT attribute."productId", ${score(Prisma.sql`attribute.term`, 4)} AS score
      FROM (
        WITH RECURSIVE ${catalogCategorySubtreeCte},
        scoped_products AS (
          SELECT id FROM "products" WHERE status = 'ACTIVE' AND "deletedAt" IS NULL
        ),
        ${catalogAttributeValuesCtes}
        SELECT v."productId", normalize_fa_search(field.value) AS term, TRUE AS fuzzy
        FROM valid_attribute_choices v
        JOIN attribute_definitions d ON d.code = v.code
        JOIN attribute_options option ON option.code = v.code AND option.value = ANY(v.choices)
        CROSS JOIN LATERAL (VALUES (option.label), (option.value), (d.label || ' ' || option.label)) field(value)
        WHERE d.kind <> 'BOOLEAN' OR field.value = d.label || ' ' || option.label
        UNION ALL
        SELECT v."productId", normalize_fa_search(field.value), FALSE
        FROM valid_attribute_ranges v
        JOIN attribute_definitions d ON d.code = v.code
        CROSS JOIN LATERAL (
          VALUES (trim_scale(v.minimum)::text), (trim_scale(v.maximum)::text),
            (d.label || ' ' || trim_scale(v.minimum)::text), (d.label || ' ' || trim_scale(v.maximum)::text)
        ) field(value)
      ) attribute CROSS JOIN search_query
      WHERE (attribute.fuzzy AND ${textMatches(Prisma.sql`attribute.term`)})
        OR (NOT attribute.fuzzy AND attribute.term = search_query.value)
    )
  `;
}

export function publicNamedSuggestionSql(search: string, kind: 'category' | 'brand') {
  const table = kind === 'category' ? Prisma.sql`"categories"` : Prisma.sql`"brands"`;
  const name = Prisma.sql`normalize_fa_search(entity.name)`;
  const slug = Prisma.sql`normalize_fa_search(entity.slug)`;
  return Prisma.sql`
    WITH ${searchTermsCte(search)},
    candidates AS (
      SELECT entity.id, MAX(GREATEST(
        CASE WHEN ${textMatches(name)} THEN ${score(name, 2)} END,
        CASE WHEN ${textMatches(slug)} THEN ${score(slug, 1)} END
      )) AS score
      FROM ${table} entity CROSS JOIN search_query
      WHERE entity."isActive" AND entity."deletedAt" IS NULL
        AND (${textMatches(name)} OR ${textMatches(slug)})
      GROUP BY entity.id
    )
    SELECT entity.id, entity.name, entity.slug
    FROM candidates JOIN ${table} entity ON entity.id = candidates.id
    ORDER BY candidates.score DESC, ${kind === 'category' ? Prisma.sql`entity."sortOrder" ASC,` : Prisma.empty}
      entity.name ASC, entity.id ASC
    LIMIT 4
  `;
}
