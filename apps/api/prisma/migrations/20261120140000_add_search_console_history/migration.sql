BEGIN;

-- CreateEnum
CREATE TYPE "SeoSyncStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateTable
CREATE TABLE "seo_integrations" (
    "id" UUID NOT NULL,
    "property" VARCHAR(128) NOT NULL,
    "plannedOn" DATE,
    "plannedScope" VARCHAR(100),
    "pausedUntil" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seo_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seo_sync_runs" (
    "id" UUID NOT NULL,
    "integrationId" UUID NOT NULL,
    "metricDate" DATE NOT NULL,
    "scheduledOn" DATE NOT NULL,
    "searchType" VARCHAR(20) NOT NULL,
    "status" "SeoSyncStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "availableAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaseUntil" TIMESTAMPTZ(3),
    "startedAt" TIMESTAMPTZ(3),
    "finishedAt" TIMESTAMPTZ(3),
    "errorCode" VARCHAR(50),
    "rowCount" INTEGER,
    "coverage" JSONB,

    CONSTRAINT "seo_sync_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seo_url_inventory" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "integrationId" UUID NOT NULL,
    "urlKey" CHAR(64) NOT NULL,
    "reportedUrl" TEXT NOT NULL,
    "reportedPath" TEXT NOT NULL,
    "reportedSearch" TEXT,
    "normalizedPath" TEXT NOT NULL,
    "canonicalPath" TEXT,
    "matchedBy" VARCHAR(12),
    "productId" UUID,
    "categoryId" UUID,
    "brandId" UUID,
    "articleId" UUID,
    "firstObservedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastObservedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seo_url_inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seo_performance_daily" (
    "integrationId" UUID NOT NULL,
    "metricDate" DATE NOT NULL,
    "dimensionKey" CHAR(64) NOT NULL,
    "searchType" VARCHAR(20) NOT NULL,
    "scope" VARCHAR(24) NOT NULL,
    "aggregation" VARCHAR(16),
    "device" VARCHAR(16),
    "searchQuery" TEXT,
    "brand" VARCHAR(16),
    "brandSource" VARCHAR(12),
    "urlId" UUID,
    "clicks" DOUBLE PRECISION NOT NULL,
    "impressions" DOUBLE PRECISION NOT NULL,
    "averagePosition" DOUBLE PRECISION,
    "syncRunId" UUID,
    "sourceVersion" DATE NOT NULL,

    CONSTRAINT "seo_performance_daily_pkey" PRIMARY KEY ("integrationId","metricDate","dimensionKey")
);

-- CreateIndex
CREATE UNIQUE INDEX "seo_integrations_property_key" ON "seo_integrations"("property");

-- CreateIndex
CREATE INDEX "seo_sync_runs_integrationId_status_availableAt_idx" ON "seo_sync_runs"("integrationId", "status", "availableAt");

-- CreateIndex
CREATE INDEX "seo_sync_runs_integrationId_status_leaseUntil_idx" ON "seo_sync_runs"("integrationId", "status", "leaseUntil");

-- CreateIndex
CREATE INDEX "seo_sync_runs_integrationId_finishedAt_idx" ON "seo_sync_runs"("integrationId", "finishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "seo_sync_runs_schedule_key" ON "seo_sync_runs"("integrationId", "metricDate", "searchType", "scheduledOn");

CREATE UNIQUE INDEX "seo_sync_runs_one_running_per_integration"
ON "seo_sync_runs"("integrationId") WHERE "status" = 'RUNNING';

ALTER TABLE "seo_sync_runs" ADD CONSTRAINT "seo_sync_runs_lease_check"
CHECK (("status" = 'RUNNING') = ("leaseUntil" IS NOT NULL));

-- CreateIndex
CREATE INDEX "seo_url_inventory_productId_idx" ON "seo_url_inventory"("productId");

-- CreateIndex
CREATE INDEX "seo_url_inventory_categoryId_idx" ON "seo_url_inventory"("categoryId");

-- CreateIndex
CREATE INDEX "seo_url_inventory_brandId_idx" ON "seo_url_inventory"("brandId");

-- CreateIndex
CREATE INDEX "seo_url_inventory_articleId_idx" ON "seo_url_inventory"("articleId");

-- CreateIndex
CREATE UNIQUE INDEX "seo_url_inventory_integrationId_urlKey_key" ON "seo_url_inventory"("integrationId", "urlKey");

-- CreateIndex
CREATE INDEX "seo_performance_daily_scope_idx" ON "seo_performance_daily"("integrationId", "searchType", "scope", "metricDate");

-- CreateIndex
CREATE INDEX "seo_performance_daily_urlId_searchType_scope_metricDate_idx" ON "seo_performance_daily"("urlId", "searchType", "scope", "metricDate");

-- CreateIndex
CREATE INDEX "seo_performance_daily_syncRunId_idx" ON "seo_performance_daily"("syncRunId");

-- AddForeignKey
ALTER TABLE "seo_sync_runs" ADD CONSTRAINT "seo_sync_runs_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "seo_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seo_url_inventory" ADD CONSTRAINT "seo_url_inventory_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "seo_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seo_url_inventory" ADD CONSTRAINT "seo_url_inventory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seo_url_inventory" ADD CONSTRAINT "seo_url_inventory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seo_url_inventory" ADD CONSTRAINT "seo_url_inventory_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seo_url_inventory" ADD CONSTRAINT "seo_url_inventory_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "guide_articles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seo_performance_daily" ADD CONSTRAINT "seo_performance_daily_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "seo_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seo_performance_daily" ADD CONSTRAINT "seo_performance_daily_urlId_fkey" FOREIGN KEY ("urlId") REFERENCES "seo_url_inventory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seo_performance_daily" ADD CONSTRAINT "seo_performance_daily_syncRunId_fkey" FOREIGN KEY ("syncRunId") REFERENCES "seo_sync_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

COMMIT;
