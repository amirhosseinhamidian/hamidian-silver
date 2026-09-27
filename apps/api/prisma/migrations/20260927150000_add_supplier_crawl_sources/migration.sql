-- CreateEnum
CREATE TYPE "SupplierCrawlerType" AS ENUM ('GENERIC_HTML', 'JSON_LD', 'CUSTOM_ADAPTER', 'API', 'CSV', 'XML');

-- CreateEnum
CREATE TYPE "SupplierCrawlRunStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'PARTIAL', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SupplierCrawlScope" AS ENUM ('PRODUCT_URL', 'CATEGORY_URL', 'SCHEDULED');

-- CreateTable
CREATE TABLE "supplier_sources" (
    "id" UUID NOT NULL,
    "supplierId" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "baseUrl" VARCHAR(1000) NOT NULL,
    "hostname" VARCHAR(253) NOT NULL,
    "crawlerType" "SupplierCrawlerType" NOT NULL,
    "adapterKey" VARCHAR(100),
    "crawlDelayMs" INTEGER NOT NULL DEFAULT 2000,
    "maxConcurrency" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "supplier_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_crawl_runs" (
    "id" UUID NOT NULL,
    "supplierSourceId" UUID NOT NULL,
    "scope" "SupplierCrawlScope" NOT NULL,
    "targetUrl" VARCHAR(2000) NOT NULL,
    "status" "SupplierCrawlRunStatus" NOT NULL DEFAULT 'QUEUED',
    "discoveredCount" INTEGER NOT NULL DEFAULT 0,
    "succeededCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" VARCHAR(1000),
    "startedAt" TIMESTAMPTZ(3),
    "finishedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_crawl_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "supplier_sources_supplierId_hostname_key" ON "supplier_sources"("supplierId", "hostname");

-- CreateIndex
CREATE INDEX "supplier_sources_supplierId_isActive_idx" ON "supplier_sources"("supplierId", "isActive");

-- CreateIndex
CREATE INDEX "supplier_sources_crawlerType_isActive_idx" ON "supplier_sources"("crawlerType", "isActive");

-- CreateIndex
CREATE INDEX "supplier_sources_deletedAt_idx" ON "supplier_sources"("deletedAt");

-- CreateIndex
CREATE INDEX "supplier_crawl_runs_supplierSourceId_createdAt_idx" ON "supplier_crawl_runs"("supplierSourceId", "createdAt");

-- CreateIndex
CREATE INDEX "supplier_crawl_runs_status_createdAt_idx" ON "supplier_crawl_runs"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "supplier_sources" ADD CONSTRAINT "supplier_sources_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_crawl_runs" ADD CONSTRAINT "supplier_crawl_runs_supplierSourceId_fkey" FOREIGN KEY ("supplierSourceId") REFERENCES "supplier_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
