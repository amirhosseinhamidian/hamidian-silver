ALTER TABLE "site_settings"
  ADD COLUMN "catalogHeroMobileMediaId" UUID;

ALTER TABLE "storefront_content_pages"
  ADD COLUMN "heroMobileMediaId" UUID;

ALTER TABLE "categories"
  ADD COLUMN "heroMobileImageId" UUID;

ALTER TABLE "brands"
  ADD COLUMN "heroMobileImageId" UUID;

ALTER TABLE "homepage_hero_slides"
  ADD COLUMN "mobileMediaId" UUID;

CREATE INDEX "site_settings_catalogHeroMobileMediaId_idx"
  ON "site_settings"("catalogHeroMobileMediaId");

CREATE INDEX "storefront_content_pages_heroMobileMediaId_idx"
  ON "storefront_content_pages"("heroMobileMediaId");

CREATE INDEX "categories_heroMobileImageId_idx"
  ON "categories"("heroMobileImageId");

CREATE INDEX "brands_heroMobileImageId_idx"
  ON "brands"("heroMobileImageId");

CREATE INDEX "homepage_hero_slides_mobileMediaId_idx"
  ON "homepage_hero_slides"("mobileMediaId");

ALTER TABLE "site_settings"
  ADD CONSTRAINT "site_settings_catalogHeroMobileMediaId_fkey"
  FOREIGN KEY ("catalogHeroMobileMediaId") REFERENCES "media"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "storefront_content_pages"
  ADD CONSTRAINT "storefront_content_pages_heroMobileMediaId_fkey"
  FOREIGN KEY ("heroMobileMediaId") REFERENCES "media"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "categories"
  ADD CONSTRAINT "categories_heroMobileImageId_fkey"
  FOREIGN KEY ("heroMobileImageId") REFERENCES "media"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "brands"
  ADD CONSTRAINT "brands_heroMobileImageId_fkey"
  FOREIGN KEY ("heroMobileImageId") REFERENCES "media"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "homepage_hero_slides"
  ADD CONSTRAINT "homepage_hero_slides_mobileMediaId_fkey"
  FOREIGN KEY ("mobileMediaId") REFERENCES "media"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
