-- CreateEnum
CREATE TYPE "SupplierProductImportStatus" AS ENUM ('PENDING_REVIEW', 'REVIEWED', 'REJECTED');

-- CreateTable
CREATE TABLE "supplier_product_import_drafts" (
    "id" UUID NOT NULL,
    "supplierSourceId" UUID NOT NULL,
    "crawlRunId" UUID NOT NULL,
    "sourceProductKey" VARCHAR(120) NOT NULL,
    "sourceUrl" VARCHAR(2000) NOT NULL,
    "sourceSku" VARCHAR(120),
    "title" VARCHAR(300) NOT NULL,
    "description" TEXT,
    "sourceCategory" VARCHAR(300),
    "supplierRetailPriceToman" INTEGER,
    "weightGrams" DECIMAL(10,3),
    "attributes" JSONB NOT NULL,
    "imageUrls" VARCHAR(2000)[],
    "rawPayload" JSONB NOT NULL,
    "status" "SupplierProductImportStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "reviewedAt" TIMESTAMPTZ(3),
    "reviewedByUserId" UUID,
    "lastCrawledAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "supplier_product_import_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "supplier_product_import_drafts_supplierSourceId_sourceProductKey_key" ON "supplier_product_import_drafts"("supplierSourceId", "sourceProductKey");

-- CreateIndex
CREATE INDEX "supplier_product_import_drafts_status_updatedAt_idx" ON "supplier_product_import_drafts"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "supplier_product_import_drafts_supplierSourceId_updatedAt_idx" ON "supplier_product_import_drafts"("supplierSourceId", "updatedAt");

-- CreateIndex
CREATE INDEX "supplier_product_import_drafts_crawlRunId_idx" ON "supplier_product_import_drafts"("crawlRunId");

-- CreateIndex
CREATE INDEX "supplier_product_import_drafts_reviewedByUserId_idx" ON "supplier_product_import_drafts"("reviewedByUserId");

-- AddForeignKey
ALTER TABLE "supplier_product_import_drafts" ADD CONSTRAINT "supplier_product_import_drafts_supplierSourceId_fkey" FOREIGN KEY ("supplierSourceId") REFERENCES "supplier_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_product_import_drafts" ADD CONSTRAINT "supplier_product_import_drafts_crawlRunId_fkey" FOREIGN KEY ("crawlRunId") REFERENCES "supplier_crawl_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_product_import_drafts" ADD CONSTRAINT "supplier_product_import_drafts_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
