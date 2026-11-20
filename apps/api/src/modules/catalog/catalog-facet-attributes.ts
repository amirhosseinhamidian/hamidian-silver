import { Prisma } from '../../generated/prisma/client';

export const catalogFacetAttributesCtes = Prisma.sql`
  attribute_definitions AS MATERIALIZED (
    SELECT v.*, d.code
    FROM "catalog_attribute_definitions" d
    JOIN "catalog_attribute_versions" v
      ON v."attributeCode" = d.code AND v.version = d."currentVersion"
    WHERE v."isActive" AND v.source = 'MANUAL'
  ),
  attribute_options AS MATERIALIZED (
    SELECT d.code, option.value ->> 'code' AS value, option.value ->> 'label' AS label
    FROM attribute_definitions d
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(d.options) = 'array' THEN d.options ELSE '[]'::jsonb END
    ) option
    WHERE d.kind IN ('SELECT', 'MULTI_SELECT')
      AND jsonb_typeof(option.value -> 'code') = 'string'
      AND jsonb_typeof(option.value -> 'label') = 'string'
    UNION ALL
    SELECT d.code, option.value, option.label
    FROM attribute_definitions d
    CROSS JOIN (VALUES ('true', 'بله'), ('false', 'خیر')) option(value, label)
    WHERE d.kind = 'BOOLEAN'
  ),
  invalid_attribute_filters AS (
    SELECT filter.code
    FROM requested_attributes filter
    LEFT JOIN attribute_definitions d ON d.code = filter.code
    WHERE d.code IS NULL OR (
      filter.choices IS NOT NULL AND (
        d.kind NOT IN ('SELECT', 'MULTI_SELECT', 'BOOLEAN') OR EXISTS (
          SELECT 1 FROM jsonb_array_elements_text(filter.choices) choice(value)
          WHERE NOT EXISTS (
            SELECT 1 FROM attribute_options opt WHERE opt.code = filter.code AND opt.value = choice.value
          )
        )
      )
    ) OR (filter.choices IS NULL AND d.kind NOT IN ('NUMBER', 'RANGE'))
  ),
  current_values AS MATERIALIZED (
    SELECT DISTINCT ON (v."productId", v."attributeCode")
      v."productId", v."attributeCode" AS code, v.value
    FROM scoped_products p
    JOIN "catalog_product_attribute_values" v ON v."productId" = p.id
    JOIN attribute_definitions d ON d.code = v."attributeCode"
    ORDER BY v."productId", v."attributeCode", v.revision DESC
  ),
  attribute_category_scope AS MATERIALIZED (
    SELECT DISTINCT d.code, included."categoryId"
    FROM attribute_definitions d
    JOIN subtree included ON included."rootId" = ANY(d."categoryIds")
    WHERE NOT EXISTS (
      SELECT 1 FROM subtree excluded
      JOIN subtree path ON path."rootId" = included."rootId" AND path."categoryId" = excluded."rootId"
      WHERE excluded."categoryId" = included."categoryId"
        AND excluded."rootId" = ANY(d."excludedCategoryIds")
    )
  ),
  applicable_values AS MATERIALIZED (
    SELECT v."productId", v.code, d.kind, d.unit, v.value
    FROM current_values v
    JOIN attribute_definitions d ON d.code = v.code
    WHERE v.value IS NOT NULL AND EXISTS (
      SELECT 1 FROM "product_categories" membership
      JOIN attribute_category_scope allowed ON allowed."categoryId" = membership."categoryId"
        AND allowed.code = v.code
      WHERE membership."productId" = v."productId"
    )
  ),
  raw_attribute_choices AS (
    SELECT v."productId", v.code, CASE
      WHEN v.kind = 'SELECT'
        AND jsonb_typeof(v.value -> 'optionCode') = 'string'
        AND v.value = jsonb_build_object('optionCode', v.value -> 'optionCode')
        THEN jsonb_build_array(v.value -> 'optionCode')
      WHEN v.kind = 'MULTI_SELECT'
        AND jsonb_typeof(v.value -> 'optionCodes') = 'array'
        AND v.value = jsonb_build_object('optionCodes', v.value -> 'optionCodes')
        THEN v.value -> 'optionCodes'
      WHEN v.kind = 'BOOLEAN'
        AND jsonb_typeof(v.value -> 'boolean') = 'boolean'
        AND v.value = jsonb_build_object('boolean', v.value -> 'boolean')
        THEN jsonb_build_array(v.value -> 'boolean')
      ELSE '[]'::jsonb END AS choices
    FROM applicable_values v
    WHERE v.kind IN ('SELECT', 'MULTI_SELECT', 'BOOLEAN')
  ),
  valid_attribute_choices AS MATERIALIZED (
    SELECT v."productId", v.code, array_agg(DISTINCT opt.value) AS choices
    FROM raw_attribute_choices v
    CROSS JOIN LATERAL jsonb_array_elements_text(v.choices) choice(value)
    JOIN attribute_options opt ON opt.code = v.code AND opt.value = choice.value
    GROUP BY v."productId", v.code, v.choices
    HAVING COUNT(DISTINCT opt.value) = jsonb_array_length(v.choices)
  ),
  raw_attribute_ranges AS (
    SELECT v."productId", v.code, v.unit, CASE
      WHEN v.kind = 'NUMBER' AND jsonb_typeof(v.value -> 'number') = 'number'
        AND v.value = jsonb_build_object('unit', v.unit::text, 'number', v.value -> 'number')
        THEN (v.value ->> 'number')::numeric
      WHEN v.kind = 'RANGE' AND jsonb_typeof(v.value -> 'min') = 'number'
        AND jsonb_typeof(v.value -> 'max') = 'number'
        AND v.value = jsonb_build_object('unit', v.unit::text, 'min', v.value -> 'min', 'max', v.value -> 'max')
        THEN (v.value ->> 'min')::numeric
      END AS minimum,
      CASE
        WHEN v.kind = 'NUMBER' AND jsonb_typeof(v.value -> 'number') = 'number'
          THEN (v.value ->> 'number')::numeric
        WHEN v.kind = 'RANGE' AND jsonb_typeof(v.value -> 'max') = 'number'
          THEN (v.value ->> 'max')::numeric
      END AS maximum
    FROM applicable_values v
    WHERE v.kind IN ('NUMBER', 'RANGE')
  ),
  valid_attribute_ranges AS MATERIALIZED (
    SELECT "productId", code, minimum, maximum
    FROM raw_attribute_ranges
    WHERE minimum <= maximum AND minimum >= -1000000 AND maximum <= 1000000
      AND round(minimum, 3) = minimum AND round(maximum, 3) = maximum
      AND CASE
        WHEN unit = 'PER_MILLE' THEN minimum > 0 AND maximum <= 1000
          AND trunc(minimum) = minimum AND trunc(maximum) = maximum
        WHEN unit = 'MILLIMETER' THEN minimum > 0 AND maximum <= 100000
        WHEN unit = 'NONE' THEN true
        ELSE minimum >= 0
      END
  ),
  product_requirements AS MATERIALIZED (
    SELECT p.*, ARRAY(
      SELECT filter.code FROM requested_attributes filter
      WHERE NOT EXISTS (
        SELECT 1 FROM valid_attribute_choices v
        WHERE v."productId" = p.id AND v.code = filter.code AND filter.choices ?| v.choices
      ) AND NOT EXISTS (
        SELECT 1 FROM valid_attribute_ranges v
        WHERE v."productId" = p.id AND v.code = filter.code AND filter.choices IS NULL
          AND (filter.minimum IS NULL OR v.maximum >= filter.minimum)
          AND (filter.maximum IS NULL OR v.minimum <= filter.maximum)
      )
    ) AS "missingAttributes"
    FROM scoped_products p
  )
`;

export const catalogAttributeFacetCountsCtes = Prisma.sql`
  attribute_choice_counts AS (
    SELECT v.code, opt.value, opt.label, COUNT(*) AS count
    FROM valid_attribute_choices v
    JOIN eligible_products p ON p.id = v."productId"
      AND p.scope = CASE WHEN EXISTS (SELECT 1 FROM requested_attributes f WHERE f.code = v.code)
        THEN 'attribute:' || v.code ELSE 'results' END
    JOIN attribute_options opt ON opt.code = v.code AND opt.value = ANY(v.choices)
    GROUP BY v.code, opt.value, opt.label
  ),
  attribute_choice_facets AS (
    SELECT code, jsonb_agg(jsonb_build_object('value', value, 'label', label, 'count', count)
      ORDER BY count DESC, value) AS options
    FROM attribute_choice_counts GROUP BY code
  ),
  attribute_range_facets AS (
    SELECT v.code, jsonb_build_object('min', MIN(v.minimum), 'max', MAX(v.maximum),
      'count', COUNT(*)) AS range
    FROM valid_attribute_ranges v
    JOIN eligible_products p ON p.id = v."productId"
      AND p.scope = CASE WHEN EXISTS (SELECT 1 FROM requested_attributes f WHERE f.code = v.code)
        THEN 'attribute:' || v.code ELSE 'results' END
    GROUP BY v.code
  ),
  attribute_facets AS (
    SELECT jsonb_agg(jsonb_build_object('code', d.code, 'label', d.label, 'kind', d.kind,
      'unit', d.unit, 'options', COALESCE(c.options, '[]'::jsonb), 'range', r.range)
      ORDER BY d."sortOrder", d.code) AS facets
    FROM attribute_definitions d
    LEFT JOIN attribute_choice_facets c ON c.code = d.code
    LEFT JOIN attribute_range_facets r ON r.code = d.code
    WHERE c.code IS NOT NULL OR r.code IS NOT NULL
  )
`;
