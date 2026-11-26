CREATE TABLE "seo_inspection_states" (
    "property" VARCHAR(128) PRIMARY KEY,
    "budgetDay" DATE NOT NULL,
    "used" INTEGER NOT NULL DEFAULT 0,
    "plannedDay" DATE,
    "leaseToken" UUID,
    "leaseUntil" TIMESTAMPTZ(3),
    "pausedUntil" TIMESTAMPTZ(3),
    "pauseReason" VARCHAR(50),
    CONSTRAINT "seo_inspection_states_used_nonnegative" CHECK ("used" >= 0)
);

CREATE TABLE "seo_inspection_targets" (
    "property" VARCHAR(128) NOT NULL,
    "origin" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "priority" INTEGER NOT NULL,
    "source" VARCHAR(30) NOT NULL,
    "queued" BOOLEAN NOT NULL DEFAULT true,
    "dueAt" TIMESTAMPTZ(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMPTZ(3),
    "lastError" VARCHAR(50),
    "observedAt" TIMESTAMPTZ(3),
    "observation" JSONB,
    CONSTRAINT "seo_inspection_targets_pkey" PRIMARY KEY ("property", "origin", "path")
);

CREATE TABLE "seo_coverage_imports" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "property" VARCHAR(128) NOT NULL,
    "origin" TEXT NOT NULL,
    "label" VARCHAR(120) NOT NULL,
    "reportDate" DATE NOT NULL,
    "importedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "digest" CHAR(64) NOT NULL,
    "rowCount" INTEGER NOT NULL,
    "rows" JSONB NOT NULL
);

CREATE INDEX "seo_inspection_targets_queue_idx" ON "seo_inspection_targets" ("property", "origin", "queued", "dueAt", "priority");
CREATE INDEX "seo_inspection_targets_observed_idx" ON "seo_inspection_targets" ("property", "origin", "observedAt");
CREATE UNIQUE INDEX "seo_coverage_imports_digest_key" ON "seo_coverage_imports" ("property", "origin", "digest");
CREATE INDEX "seo_coverage_imports_recent_idx" ON "seo_coverage_imports" ("property", "origin", "importedAt");
