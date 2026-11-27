BEGIN;

CREATE OR REPLACE FUNCTION normalize_fa_search(input TEXT)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT BTRIM(REGEXP_REPLACE(
    REGEXP_REPLACE(
      LOWER(TRANSLATE(
        NORMALIZE(COALESCE(input, ''), NFKC),
        'يىك۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩',
        'ییک01234567890123456789'
      )),
      U&'[\0640\064B-\065F\0670\061C\200E\200F]',
      '',
      'g'
    ),
    U&'[[:space:]\200C\200D_\2010-\2015-]+',
    ' ',
    'g'
  ));
$$;

-- The stored index keys must be rebuilt after changing the immutable expression.
REINDEX INDEX "products_search_name_trgm_idx";
REINDEX INDEX "products_search_description_trgm_idx";
REINDEX INDEX "brands_search_name_trgm_idx";
REINDEX INDEX "categories_search_name_trgm_idx";
REINDEX INDEX "product_variants_search_sku_trgm_idx";

CREATE INDEX "products_search_slug_trgm_idx"
  ON "products" USING GIN (normalize_fa_search("slug") gin_trgm_ops)
  WHERE "status" = 'ACTIVE' AND "deletedAt" IS NULL;

CREATE INDEX "brands_search_slug_trgm_idx"
  ON "brands" USING GIN (normalize_fa_search("slug") gin_trgm_ops)
  WHERE "isActive" AND "deletedAt" IS NULL;

CREATE INDEX "categories_search_slug_trgm_idx"
  ON "categories" USING GIN (normalize_fa_search("slug") gin_trgm_ops)
  WHERE "isActive" AND "deletedAt" IS NULL;

CREATE TABLE "catalog_search_daily" (
    "day" DATE NOT NULL,
    "term" VARCHAR(100) NOT NULL,
    "searches" BIGINT NOT NULL DEFAULT 0,
    "withoutResult" BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT "catalog_search_daily_pkey" PRIMARY KEY ("day", "term"),
    CONSTRAINT "catalog_search_daily_count_check" CHECK ("withoutResult" >= 0 AND "searches" >= "withoutResult")
);

COMMIT;
