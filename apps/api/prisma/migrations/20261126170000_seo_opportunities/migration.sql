CREATE TYPE "SeoOpportunityStatus" AS ENUM ('PENDING', 'APPROVED', 'DEFERRED', 'TASK_CREATED', 'REJECTED');

CREATE TABLE "seo_opportunities" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "key" CHAR(64) NOT NULL UNIQUE,
    "property" VARCHAR(128) NOT NULL,
    "origin" TEXT NOT NULL,
    "entityKind" VARCHAR(16) NOT NULL,
    "entityId" UUID NOT NULL,
    "rule" VARCHAR(40) NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "score" INTEGER NOT NULL CHECK ("score" BETWEEN 0 AND 100),
    "scoreVersion" INTEGER NOT NULL,
    "evidence" JSONB NOT NULL,
    "status" "SeoOpportunityStatus" NOT NULL DEFAULT 'PENDING',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "refreshedAt" TIMESTAMPTZ(3) NOT NULL,
    "deferredUntil" DATE
);

CREATE TABLE "seo_correction_tasks" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "opportunityId" UUID NOT NULL REFERENCES "seo_opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "instruction" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "implementedOn" DATE,
    "windowDays" INTEGER CHECK ("windowDays" IN (7, 14, 28)),
    "changeNote" VARCHAR(1000),
    "confounders" VARCHAR(1000),
    "impact" JSONB
);

CREATE TABLE "seo_opportunity_events" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "opportunityId" UUID NOT NULL REFERENCES "seo_opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "actorId" UUID REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    "action" VARCHAR(24) NOT NULL,
    "note" VARCHAR(1000),
    "recordedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "snapshot" JSONB
);

CREATE INDEX "seo_opportunities_queue_idx" ON "seo_opportunities" ("property", "origin", "status", "active", "score");
CREATE INDEX "seo_opportunities_entity_idx" ON "seo_opportunities" ("property", "origin", "entityKind", "entityId");
CREATE UNIQUE INDEX "seo_correction_tasks_opportunityId_key" ON "seo_correction_tasks" ("opportunityId");
CREATE INDEX "seo_opportunity_events_recent_idx" ON "seo_opportunity_events" ("opportunityId", "recordedAt");
CREATE INDEX "seo_opportunity_events_actorId_idx" ON "seo_opportunity_events" ("actorId");
