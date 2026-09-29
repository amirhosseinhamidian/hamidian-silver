CREATE TABLE "supplier_crawl_schedules" (
    "id" UUID NOT NULL,
    "supplierSourceId" UUID NOT NULL,
    "categoryIds" UUID[] DEFAULT ARRAY[]::UUID[],
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "timeOfDay" VARCHAR(5) NOT NULL DEFAULT '02:00',
    "timezone" VARCHAR(64) NOT NULL DEFAULT 'Asia/Tehran',
    "requestedLimit" INTEGER NOT NULL DEFAULT 100,
    "stopAtKnown" BOOLEAN NOT NULL DEFAULT true,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "retryDelayMinutes" INTEGER NOT NULL DEFAULT 15,
    "nextRunAt" TIMESTAMPTZ(3),
    "lastEnqueuedAt" TIMESTAMPTZ(3),
    "lastFinishedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "supplier_crawl_schedules_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "supplier_crawl_runs"
ADD COLUMN "scheduleId" UUID,
ADD COLUMN "retryCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "maxRetries" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "retryDelayMinutes" INTEGER NOT NULL DEFAULT 15,
ADD COLUMN "availableAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX "supplier_crawl_schedules_supplierSourceId_key"
ON "supplier_crawl_schedules"("supplierSourceId");

CREATE INDEX "supplier_crawl_schedules_isEnabled_nextRunAt_idx"
ON "supplier_crawl_schedules"("isEnabled", "nextRunAt");

CREATE INDEX "supplier_crawl_runs_status_availableAt_createdAt_idx"
ON "supplier_crawl_runs"("status", "availableAt", "createdAt");

CREATE INDEX "supplier_crawl_runs_scheduleId_idx"
ON "supplier_crawl_runs"("scheduleId");

ALTER TABLE "supplier_crawl_schedules"
ADD CONSTRAINT "supplier_crawl_schedules_supplierSourceId_fkey"
FOREIGN KEY ("supplierSourceId") REFERENCES "supplier_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "supplier_crawl_runs"
ADD CONSTRAINT "supplier_crawl_runs_scheduleId_fkey"
FOREIGN KEY ("scheduleId") REFERENCES "supplier_crawl_schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;
