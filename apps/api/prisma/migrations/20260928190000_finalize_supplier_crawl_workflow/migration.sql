CREATE TYPE "SupplierSourceAvailability" AS ENUM ('UNKNOWN', 'IN_STOCK', 'OUT_OF_STOCK');
CREATE TYPE "SupplierProductSourceChangeType" AS ENUM ('PRICE', 'AVAILABILITY');

ALTER TABLE "supplier_crawl_runs"
ADD COLUMN "monitorKnownProducts" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "supplier_crawl_schedules"
ADD COLUMN "monitorKnownProducts" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "supplier_source_categories"
ADD COLUMN "catalogCategoryId" UUID;

ALTER TABLE "supplier_product_import_drafts"
ADD COLUMN "sourceCategoryId" UUID,
ADD COLUMN "sourceAvailability" "SupplierSourceAvailability" NOT NULL DEFAULT 'UNKNOWN';

UPDATE "supplier_product_import_drafts" AS draft
SET "sourceCategoryId" = category."id"
FROM "supplier_source_categories" AS category
WHERE category."supplierSourceId" = draft."supplierSourceId"
  AND category."name" = draft."sourceCategory";

CREATE TABLE "supplier_product_source_changes" (
    "id" UUID NOT NULL,
    "draftId" UUID NOT NULL,
    "crawlRunId" UUID NOT NULL,
    "type" "SupplierProductSourceChangeType" NOT NULL,
    "previousValue" VARCHAR(500),
    "newValue" VARCHAR(500),
    "acknowledgedAt" TIMESTAMPTZ(3),
    "acknowledgedByUserId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "supplier_product_source_changes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "supplier_crawl_issues" (
    "id" UUID NOT NULL,
    "crawlRunId" UUID NOT NULL,
    "sourceUrl" VARCHAR(2000) NOT NULL,
    "errorMessage" VARCHAR(1000) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "supplier_crawl_issues_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "supplier_source_categories_catalogCategoryId_idx" ON "supplier_source_categories"("catalogCategoryId");
CREATE INDEX "supplier_product_import_drafts_sourceCategoryId_idx" ON "supplier_product_import_drafts"("sourceCategoryId");
CREATE INDEX "supplier_product_source_changes_acknowledgedAt_createdAt_idx" ON "supplier_product_source_changes"("acknowledgedAt", "createdAt");
CREATE INDEX "supplier_product_source_changes_draftId_createdAt_idx" ON "supplier_product_source_changes"("draftId", "createdAt");
CREATE INDEX "supplier_product_source_changes_crawlRunId_idx" ON "supplier_product_source_changes"("crawlRunId");
CREATE INDEX "supplier_product_source_changes_acknowledgedByUserId_idx" ON "supplier_product_source_changes"("acknowledgedByUserId");
CREATE INDEX "supplier_crawl_issues_crawlRunId_createdAt_idx" ON "supplier_crawl_issues"("crawlRunId", "createdAt");

ALTER TABLE "supplier_source_categories"
ADD CONSTRAINT "supplier_source_categories_catalogCategoryId_fkey"
FOREIGN KEY ("catalogCategoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "supplier_product_import_drafts"
ADD CONSTRAINT "supplier_product_import_drafts_sourceCategoryId_fkey"
FOREIGN KEY ("sourceCategoryId") REFERENCES "supplier_source_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "supplier_product_source_changes"
ADD CONSTRAINT "supplier_product_source_changes_draftId_fkey"
FOREIGN KEY ("draftId") REFERENCES "supplier_product_import_drafts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "supplier_product_source_changes"
ADD CONSTRAINT "supplier_product_source_changes_crawlRunId_fkey"
FOREIGN KEY ("crawlRunId") REFERENCES "supplier_crawl_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "supplier_product_source_changes"
ADD CONSTRAINT "supplier_product_source_changes_acknowledgedByUserId_fkey"
FOREIGN KEY ("acknowledgedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "supplier_crawl_issues"
ADD CONSTRAINT "supplier_crawl_issues_crawlRunId_fkey"
FOREIGN KEY ("crawlRunId") REFERENCES "supplier_crawl_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
