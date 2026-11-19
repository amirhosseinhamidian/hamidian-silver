CREATE TYPE "CatalogAttributeKind" AS ENUM ('SELECT', 'NUMBER', 'RANGE', 'BOOLEAN', 'MULTI_SELECT');
CREATE TYPE "CatalogAttributeUnit" AS ENUM ('NONE', 'GRAM', 'MILLIMETER', 'SIZE', 'PER_MILLE', 'BAR');
CREATE TYPE "CatalogAttributeSource" AS ENUM ('MANUAL', 'VARIANT_SIZE', 'VARIANT_LENGTH', 'VARIANT_WEIGHT');

CREATE TABLE "catalog_attribute_definitions" (
  "code" VARCHAR(64) NOT NULL PRIMARY KEY,
  "currentVersion" INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE "catalog_attribute_versions" (
  "attributeCode" VARCHAR(64) NOT NULL REFERENCES "catalog_attribute_definitions"("code") ON DELETE RESTRICT ON UPDATE CASCADE,
  "version" INTEGER NOT NULL,
  "label" VARCHAR(100) NOT NULL,
  "kind" "CatalogAttributeKind" NOT NULL,
  "unit" "CatalogAttributeUnit" NOT NULL,
  "source" "CatalogAttributeSource" NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "categoryIds" UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  "excludedCategoryIds" UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  "options" JSONB NOT NULL,
  "legacyMappings" JSONB NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("attributeCode", "version")
);

CREATE TABLE "catalog_product_attribute_values" (
  "productId" UUID NOT NULL REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "attributeCode" VARCHAR(64) NOT NULL,
  "revision" INTEGER NOT NULL,
  "definitionVersion" INTEGER NOT NULL,
  "value" JSONB,
  "legacyValue" VARCHAR(500),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("productId", "attributeCode", "revision"),
  CONSTRAINT "catalog_product_values_definition_fkey" FOREIGN KEY ("attributeCode", "definitionVersion")
    REFERENCES "catalog_attribute_versions"("attributeCode", "version") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "catalog_attribute_values_definition_idx"
  ON "catalog_product_attribute_values"("attributeCode", "definitionVersion");

ALTER TABLE "product_variants" ADD COLUMN "lengthMm" INTEGER;
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_lengthMm_check"
  CHECK ("lengthMm" IS NULL OR "lengthMm" BETWEEN 1 AND 100000);

-- Scope starter definitions by stable category slug. Existing product text stays untouched.
WITH starter(code, label, kind, unit, source, position, slugs, options) AS (
  VALUES
    ('silver-weave', 'نوع بافت', 'SELECT', 'NONE', 'MANUAL', 10, ARRAY['bracelets','necklaces'], '[{"code":"curb","label":"کارتیه"},{"code":"rope","label":"طنابی"},{"code":"figaro","label":"فیگارو"}]'),
    ('silver-clasp', 'نوع قفل', 'SELECT', 'NONE', 'MANUAL', 20, ARRAY['bracelets','necklaces'], '[{"code":"lobster","label":"خرچنگی"},{"code":"spring-ring","label":"حلقه‌ای"},{"code":"box","label":"جعبه‌ای"},{"code":"toggle","label":"میله‌ای"}]'),
    ('silver-kind', 'ساختار دستبند', 'SELECT', 'NONE', 'MANUAL', 30, ARRAY['bracelets'], '[{"code":"chain","label":"زنجیری"},{"code":"cuff","label":"کاف"},{"code":"plate","label":"پلاک‌دار"}]'),
    ('silver-size', 'سایز', 'SELECT', 'SIZE', 'VARIANT_SIZE', 40, ARRAY['bracelets','rings','necklaces'], '[]'),
    ('silver-length', 'طول تنوع', 'NUMBER', 'MILLIMETER', 'VARIANT_LENGTH', 50, ARRAY['bracelets','necklaces'], '[]'),
    ('silver-weight', 'وزن تنوع', 'NUMBER', 'GRAM', 'VARIANT_WEIGHT', 60, ARRAY['bracelets','necklaces','rings','earrings','silver-earrings'], '[]'),
    ('silver-fineness', 'عیار نقره', 'NUMBER', 'PER_MILLE', 'MANUAL', 70, ARRAY['bracelets','necklaces','rings','earrings','silver-earrings'], '[]'),
    ('watch-movement', 'نوع موتور', 'SELECT', 'NONE', 'MANUAL', 10, ARRAY['watch'], '[{"code":"quartz","label":"کوارتز"},{"code":"automatic","label":"اتوماتیک"},{"code":"mechanical","label":"مکانیکی"},{"code":"solar","label":"خورشیدی"}]'),
    ('watch-band', 'جنس بند', 'MULTI_SELECT', 'NONE', 'MANUAL', 20, ARRAY['watch'], '[{"code":"steel","label":"استیل"},{"code":"leather","label":"چرم"},{"code":"resin","label":"رزین"},{"code":"silicone","label":"سیلیکون"},{"code":"titanium","label":"تیتانیوم"}]'),
    ('watch-glass', 'نوع شیشه', 'SELECT', 'NONE', 'MANUAL', 30, ARRAY['watch'], '[{"code":"mineral","label":"معدنی"},{"code":"sapphire","label":"یاقوت کبود"},{"code":"acrylic","label":"اکریلیک"}]'),
    ('watch-water-resistance', 'مقاومت در برابر آب', 'NUMBER', 'BAR', 'MANUAL', 40, ARRAY['watch'], '[]')
), created AS (
  INSERT INTO "catalog_attribute_definitions" ("code")
  SELECT code FROM starter
  RETURNING code
)
INSERT INTO "catalog_attribute_versions"
  ("attributeCode", "version", "label", "kind", "unit", "source", "sortOrder", "categoryIds", "options", "legacyMappings")
SELECT starter.code, 1, label, kind::"CatalogAttributeKind", unit::"CatalogAttributeUnit",
  source::"CatalogAttributeSource", position,
  ARRAY(SELECT id FROM "categories" WHERE slug = ANY(starter.slugs) AND "deletedAt" IS NULL ORDER BY id),
  options::jsonb, '[]'::jsonb
FROM starter JOIN created ON created.code = starter.code;
