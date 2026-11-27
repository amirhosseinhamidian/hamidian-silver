CREATE TABLE "seo_audit_runs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "origin" TEXT NOT NULL,
    "ruleVersion" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMPTZ(3),
    "leaseToken" UUID,
    "leaseUntil" TIMESTAMPTZ(3),
    "pauseUntil" TIMESTAMPTZ(3),
    "sitemapPaths" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "sitemapChecked" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "seo_audit_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "seo_audit_checks" (
    "runId" UUID NOT NULL,
    "path" TEXT NOT NULL,
    "priority" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "sourcePath" TEXT,
    "expectedCanonical" TEXT,
    "productId" UUID,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkedAt" TIMESTAMPTZ(3),
    "inSitemap" BOOLEAN,
    "observation" JSONB,
    "issues" JSONB,
    CONSTRAINT "seo_audit_checks_pkey" PRIMARY KEY ("runId", "path"),
    CONSTRAINT "seo_audit_checks_runId_fkey" FOREIGN KEY ("runId") REFERENCES "seo_audit_runs" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "seo_audit_runs_origin_createdAt_idx" ON "seo_audit_runs" ("origin", "createdAt");
CREATE INDEX "seo_audit_checks_runId_checkedAt_nextAttemptAt_priority_idx" ON "seo_audit_checks" ("runId", "checkedAt", "nextAttemptAt", "priority");
CREATE INDEX "seo_audit_checks_path_checkedAt_idx" ON "seo_audit_checks" ("path", "checkedAt");
