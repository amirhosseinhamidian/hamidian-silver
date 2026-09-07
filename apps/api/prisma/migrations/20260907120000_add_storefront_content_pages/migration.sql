-- CreateEnum
CREATE TYPE "StorefrontContentPageKey" AS ENUM ('ABOUT', 'CONTACT', 'SERVICES', 'TERMS', 'PRIVACY');

-- AlterTable
ALTER TABLE "site_settings"
ADD COLUMN "galleryName" VARCHAR(150),
ADD COLUMN "footerAbout" VARCHAR(1000),
ADD COLUMN "contactAddress" VARCHAR(1000),
ADD COLUMN "contactPhoneNumbers" VARCHAR(20)[] NOT NULL DEFAULT ARRAY[]::VARCHAR(20)[],
ADD COLUMN "contactEmail" VARCHAR(320),
ADD COLUMN "instagramUrl" VARCHAR(1000),
ADD COLUMN "telegramUrl" VARCHAR(1000),
ADD COLUMN "baleUrl" VARCHAR(1000);

-- CreateTable
CREATE TABLE "storefront_content_pages" (
    "key" "StorefrontContentPageKey" NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "eyebrow" VARCHAR(100),
    "subtitle" VARCHAR(500),
    "body" TEXT,
    "heroMediaId" UUID,
    "seoTitle" VARCHAR(200),
    "seoDescription" VARCHAR(500),
    "updatedByUserId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "storefront_content_pages_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "storefront_content_sections" (
    "id" UUID NOT NULL,
    "pageKey" "StorefrontContentPageKey" NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "body" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "storefront_content_sections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "storefront_content_pages_heroMediaId_idx" ON "storefront_content_pages"("heroMediaId");

-- CreateIndex
CREATE INDEX "storefront_content_pages_updatedByUserId_idx" ON "storefront_content_pages"("updatedByUserId");

-- CreateIndex
CREATE INDEX "storefront_content_sections_pageKey_sortOrder_idx" ON "storefront_content_sections"("pageKey", "sortOrder");

-- AddForeignKey
ALTER TABLE "storefront_content_pages" ADD CONSTRAINT "storefront_content_pages_heroMediaId_fkey" FOREIGN KEY ("heroMediaId") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "storefront_content_pages" ADD CONSTRAINT "storefront_content_pages_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "storefront_content_sections" ADD CONSTRAINT "storefront_content_sections_pageKey_fkey" FOREIGN KEY ("pageKey") REFERENCES "storefront_content_pages"("key") ON DELETE CASCADE ON UPDATE CASCADE;
