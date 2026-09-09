ALTER TABLE "site_settings"
  ADD COLUMN "seoSiteName" VARCHAR(120) NOT NULL DEFAULT 'نقره حمیدیان',
  ADD COLUMN "seoDefaultTitle" VARCHAR(200) NOT NULL DEFAULT 'نقره حمیدیان',
  ADD COLUMN "seoTitleTemplate" VARCHAR(200) NOT NULL DEFAULT '%s | نقره حمیدیان',
  ADD COLUMN "seoDefaultDescription" VARCHAR(500) NOT NULL DEFAULT 'فروشگاه آنلاین و گالری نقره حمیدیان',
  ADD COLUMN "seoDefaultOgMediaId" UUID,
  ADD COLUMN "seoOrganizationName" VARCHAR(200) NOT NULL DEFAULT 'نقره حمیدیان',
  ADD COLUMN "seoOrganizationLogoMediaId" UUID,
  ADD COLUMN "seoSocialProfileUrls" VARCHAR(1000)[] NOT NULL DEFAULT ARRAY[]::VARCHAR(1000)[],
  ADD COLUMN "seoHomeTitle" VARCHAR(200),
  ADD COLUMN "seoHomeDescription" VARCHAR(500),
  ADD COLUMN "seoHomeOgMediaId" UUID;

ALTER TABLE "storefront_content_pages"
  ADD COLUMN "seoCanonicalPath" VARCHAR(1000),
  ADD COLUMN "seoNoIndex" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "seoOgMediaId" UUID;

ALTER TABLE "categories"
  ADD COLUMN "seoTitle" VARCHAR(200),
  ADD COLUMN "seoDescription" VARCHAR(500),
  ADD COLUMN "seoCanonicalPath" VARCHAR(1000),
  ADD COLUMN "seoNoIndex" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "seoOgMediaId" UUID;

ALTER TABLE "brands"
  ADD COLUMN "seoTitle" VARCHAR(200),
  ADD COLUMN "seoDescription" VARCHAR(500),
  ADD COLUMN "seoCanonicalPath" VARCHAR(1000),
  ADD COLUMN "seoNoIndex" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "seoOgMediaId" UUID;

ALTER TABLE "products"
  ADD COLUMN "seoTitle" VARCHAR(200),
  ADD COLUMN "seoDescription" VARCHAR(500),
  ADD COLUMN "seoCanonicalPath" VARCHAR(1000),
  ADD COLUMN "seoNoIndex" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "seoOgMediaId" UUID;

CREATE INDEX "site_settings_seoDefaultOgMediaId_idx" ON "site_settings"("seoDefaultOgMediaId");
CREATE INDEX "site_settings_seoOrganizationLogoMediaId_idx" ON "site_settings"("seoOrganizationLogoMediaId");
CREATE INDEX "site_settings_seoHomeOgMediaId_idx" ON "site_settings"("seoHomeOgMediaId");
CREATE INDEX "storefront_content_pages_seoOgMediaId_idx" ON "storefront_content_pages"("seoOgMediaId");
CREATE INDEX "categories_seoOgMediaId_idx" ON "categories"("seoOgMediaId");
CREATE INDEX "brands_seoOgMediaId_idx" ON "brands"("seoOgMediaId");
CREATE INDEX "products_seoOgMediaId_idx" ON "products"("seoOgMediaId");

ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_seoDefaultOgMediaId_fkey"
  FOREIGN KEY ("seoDefaultOgMediaId") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_seoOrganizationLogoMediaId_fkey"
  FOREIGN KEY ("seoOrganizationLogoMediaId") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_seoHomeOgMediaId_fkey"
  FOREIGN KEY ("seoHomeOgMediaId") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "storefront_content_pages" ADD CONSTRAINT "storefront_content_pages_seoOgMediaId_fkey"
  FOREIGN KEY ("seoOgMediaId") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "categories" ADD CONSTRAINT "categories_seoOgMediaId_fkey"
  FOREIGN KEY ("seoOgMediaId") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "brands" ADD CONSTRAINT "brands_seoOgMediaId_fkey"
  FOREIGN KEY ("seoOgMediaId") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "products" ADD CONSTRAINT "products_seoOgMediaId_fkey"
  FOREIGN KEY ("seoOgMediaId") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE CASCADE;
