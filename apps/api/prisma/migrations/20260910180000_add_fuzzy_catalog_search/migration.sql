CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE OR REPLACE FUNCTION normalize_fa_search(input TEXT)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT BTRIM(
    REGEXP_REPLACE(
      REPLACE(
        LOWER(TRANSLATE(COALESCE(input, ''), 'يىك', 'ییک')),
        U&'\200C',
        ' '
      ),
      '[[:space:]]+',
      ' ',
      'g'
    )
  );
$$;

CREATE INDEX "products_search_name_trgm_idx"
  ON "products" USING GIN (normalize_fa_search("name") gin_trgm_ops)
  WHERE "status" = 'ACTIVE' AND "deletedAt" IS NULL;

CREATE INDEX "products_search_description_trgm_idx"
  ON "products" USING GIN (normalize_fa_search("shortDescription") gin_trgm_ops)
  WHERE "status" = 'ACTIVE' AND "deletedAt" IS NULL;

CREATE INDEX "brands_search_name_trgm_idx"
  ON "brands" USING GIN (normalize_fa_search("name") gin_trgm_ops)
  WHERE "isActive" = true AND "deletedAt" IS NULL;

CREATE INDEX "categories_search_name_trgm_idx"
  ON "categories" USING GIN (normalize_fa_search("name") gin_trgm_ops)
  WHERE "isActive" = true AND "deletedAt" IS NULL;

CREATE INDEX "product_variants_search_sku_trgm_idx"
  ON "product_variants" USING GIN (normalize_fa_search("sku") gin_trgm_ops)
  WHERE "isActive" = true AND "deletedAt" IS NULL;
