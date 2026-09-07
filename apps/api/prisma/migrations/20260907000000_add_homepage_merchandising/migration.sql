CREATE TYPE "HomepageHeroPlacement" AS ENUM ('PRIMARY', 'SECONDARY');

ALTER TABLE "brands"
  ADD COLUMN "originCountryId" UUID;

CREATE INDEX "brands_originCountryId_idx" ON "brands"("originCountryId");

ALTER TABLE "brands"
  ADD CONSTRAINT "brands_originCountryId_fkey"
  FOREIGN KEY ("originCountryId") REFERENCES "countries"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "homepage_hero_slides" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "placement" "HomepageHeroPlacement" NOT NULL,
  "mediaId" UUID NOT NULL,
  "title" VARCHAR(200),
  "subtitle" VARCHAR(500),
  "actionLabel" VARCHAR(100),
  "actionHref" VARCHAR(1000),
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "homepage_hero_slides_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "homepage_hero_slides_placement_isActive_sortOrder_idx"
  ON "homepage_hero_slides"("placement", "isActive", "sortOrder");
CREATE INDEX "homepage_hero_slides_mediaId_idx"
  ON "homepage_hero_slides"("mediaId");
CREATE UNIQUE INDEX "homepage_hero_slides_single_secondary_key"
  ON "homepage_hero_slides"("placement")
  WHERE "placement" = 'SECONDARY';

ALTER TABLE "homepage_hero_slides"
  ADD CONSTRAINT "homepage_hero_slides_mediaId_fkey"
  FOREIGN KEY ("mediaId") REFERENCES "media"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "homepage_featured_categories" (
  "categoryId" UUID NOT NULL,
  "priority" INTEGER NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "homepage_featured_categories_pkey" PRIMARY KEY ("categoryId"),
  CONSTRAINT "homepage_featured_categories_priority_check" CHECK ("priority" BETWEEN 1 AND 4)
);

CREATE UNIQUE INDEX "homepage_featured_categories_priority_key"
  ON "homepage_featured_categories"("priority");

ALTER TABLE "homepage_featured_categories"
  ADD CONSTRAINT "homepage_featured_categories_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "categories"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "homepage_popular_products" (
  "productId" UUID NOT NULL,
  "priority" INTEGER NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "homepage_popular_products_pkey" PRIMARY KEY ("productId"),
  CONSTRAINT "homepage_popular_products_priority_check" CHECK ("priority" BETWEEN 1 AND 8)
);

CREATE UNIQUE INDEX "homepage_popular_products_priority_key"
  ON "homepage_popular_products"("priority");

ALTER TABLE "homepage_popular_products"
  ADD CONSTRAINT "homepage_popular_products_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "products"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
