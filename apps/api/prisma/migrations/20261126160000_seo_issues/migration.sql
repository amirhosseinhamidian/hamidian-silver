CREATE TYPE "SeoIssueStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED');
CREATE TYPE "SeoIssueSeverity" AS ENUM ('REVIEW', 'IMPORTANT', 'CRITICAL');

CREATE TABLE "seo_issues" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "issueKey" CHAR(64) NOT NULL UNIQUE,
    "property" VARCHAR(128) NOT NULL,
    "origin" TEXT NOT NULL,
    "rule" VARCHAR(80) NOT NULL,
    "subject" TEXT NOT NULL,
    "severity" "SeoIssueSeverity" NOT NULL,
    "status" "SeoIssueStatus" NOT NULL DEFAULT 'OPEN',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "ownerId" UUID REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "observedAt" TIMESTAMPTZ(3) NOT NULL,
    "firstObservedAt" TIMESTAMPTZ(3) NOT NULL,
    "lastQueuedAt" TIMESTAMPTZ(3),
    "evidence" JSONB NOT NULL
);

CREATE TABLE "seo_issue_events" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "issueId" UUID NOT NULL REFERENCES "seo_issues"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "actorId" UUID REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    "kind" VARCHAR(32) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" VARCHAR(1000),
    "evidence" JSONB
);

CREATE TABLE "seo_issue_deliveries" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "eventId" UUID NOT NULL REFERENCES "seo_issue_events"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "recipientId" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "status" "NotificationOutboxStatus" NOT NULL DEFAULT 'PENDING',
    "claimedAt" TIMESTAMPTZ(3),
    "finishedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "seo_issues_inbox_idx" ON "seo_issues" ("property", "origin", "status", "observedAt");
CREATE INDEX "seo_issues_ownerId_idx" ON "seo_issues" ("ownerId");
CREATE INDEX "seo_issue_events_issueId_createdAt_idx" ON "seo_issue_events" ("issueId", "createdAt");
CREATE INDEX "seo_issue_events_actorId_idx" ON "seo_issue_events" ("actorId");
CREATE UNIQUE INDEX "seo_issue_deliveries_event_recipient_key" ON "seo_issue_deliveries" ("eventId", "recipientId");
CREATE INDEX "seo_issue_deliveries_status_createdAt_idx" ON "seo_issue_deliveries" ("status", "createdAt");
CREATE INDEX "seo_issue_deliveries_recipientId_idx" ON "seo_issue_deliveries" ("recipientId");
