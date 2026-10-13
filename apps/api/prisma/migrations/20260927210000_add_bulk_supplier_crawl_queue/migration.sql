ALTER TYPE "SupplierCrawlRunStatus" ADD VALUE 'PAUSED';
ALTER TYPE "SupplierCrawlScope" ADD VALUE 'CATALOG';

CREATE TABLE "supplier_source_categories" (
    "id" UUID NOT NULL,
    "supplierSourceId" UUID NOT NULL,
    "externalKey" VARCHAR(120) NOT NULL,
    "name" VARCHAR(300) NOT NULL,
    "url" VARCHAR(2000) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSeenAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "supplier_source_categories_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "supplier_crawl_runs"
ADD COLUMN "categoryId" UUID,
ADD COLUMN "requestedLimit" INTEGER,
ADD COLUMN "currentPage" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "stopAtKnown" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "skippedCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "lastHeartbeatAt" TIMESTAMPTZ(3);

CREATE UNIQUE INDEX "supplier_source_categories_supplierSourceId_externalKey_key"
ON "supplier_source_categories"("supplierSourceId", "externalKey");
CREATE INDEX "supplier_source_categories_supplierSourceId_isActive_name_idx"
ON "supplier_source_categories"("supplierSourceId", "isActive", "name");
CREATE INDEX "supplier_crawl_runs_categoryId_idx" ON "supplier_crawl_runs"("categoryId");

ALTER TABLE "supplier_source_categories"
ADD CONSTRAINT "supplier_source_categories_supplierSourceId_fkey"
FOREIGN KEY ("supplierSourceId") REFERENCES "supplier_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "supplier_crawl_runs"
ADD CONSTRAINT "supplier_crawl_runs_categoryId_fkey"
FOREIGN KEY ("categoryId") REFERENCES "supplier_source_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
