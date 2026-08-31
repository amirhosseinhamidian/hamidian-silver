-- Stage 093: quarantine ambiguous external SMS outcomes and persist manual recovery audit history.
-- A DISPATCHING lease represents the non-idempotent external-send boundary. Stale dispatches
-- become UNKNOWN and require operator reconciliation instead of automatic redelivery.
-- Pre-Stage-093 PROCESSING rows are ambiguous because the old worker sent SMS while still
-- in PROCESSING. Refuse to migrate until those rows are manually drained/reconciled.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "notification_outbox_events" WHERE "status" = 'PROCESSING'
  ) OR EXISTS (
    SELECT 1 FROM "operational_alert_outbox_events" WHERE "status" = 'PROCESSING'
  ) THEN
    RAISE EXCEPTION
      'Existing PROCESSING notification outbox rows require manual reconciliation before Stage 093.';
  END IF;
END
$$;

ALTER TYPE "NotificationOutboxStatus" ADD VALUE IF NOT EXISTS 'DISPATCHING';
ALTER TYPE "NotificationOutboxStatus" ADD VALUE IF NOT EXISTS 'UNKNOWN';

CREATE TYPE "NotificationOutboxRecoveryResolution" AS ENUM ('RETRY_APPROVED', 'MARKED_SENT');

ALTER TABLE "notification_outbox_events"
  DROP CONSTRAINT "notification_outbox_events_lifecycle_valid",
  ADD CONSTRAINT "notification_outbox_events_lifecycle_valid"
  CHECK (
    (
      "status"::text = 'PENDING'
      AND "claimedAt" IS NULL
      AND "processedAt" IS NULL
    )
    OR
    (
      "status"::text = 'PROCESSING'
      AND "claimedAt" IS NOT NULL
      AND "processedAt" IS NULL
    )
    OR
    (
      "status"::text = 'DISPATCHING'
      AND "claimedAt" IS NOT NULL
      AND "processedAt" IS NULL
    )
    OR
    (
      "status"::text = 'SENT'
      AND "claimedAt" IS NULL
      AND "processedAt" IS NOT NULL
    )
    OR
    (
      "status"::text IN ('FAILED', 'UNKNOWN')
      AND "claimedAt" IS NULL
      AND "processedAt" IS NULL
    )
  );

ALTER TABLE "operational_alert_outbox_events"
  DROP CONSTRAINT "operational_alert_outbox_events_lifecycle_valid",
  ADD CONSTRAINT "operational_alert_outbox_events_lifecycle_valid"
  CHECK (
    (
      "status"::text = 'PENDING'
      AND "claimedAt" IS NULL
      AND "processedAt" IS NULL
    )
    OR
    (
      "status"::text = 'PROCESSING'
      AND "claimedAt" IS NOT NULL
      AND "processedAt" IS NULL
    )
    OR
    (
      "status"::text = 'DISPATCHING'
      AND "claimedAt" IS NOT NULL
      AND "processedAt" IS NULL
    )
    OR
    (
      "status"::text = 'SENT'
      AND "claimedAt" IS NULL
      AND "processedAt" IS NOT NULL
    )
    OR
    (
      "status"::text IN ('FAILED', 'UNKNOWN')
      AND "claimedAt" IS NULL
      AND "processedAt" IS NULL
    )
  );

CREATE TABLE "notification_outbox_recoveries" (
  "id" UUID NOT NULL,
  "eventId" UUID NOT NULL,
  "resolution" "NotificationOutboxRecoveryResolution" NOT NULL,
  "note" VARCHAR(1000) NOT NULL,
  "unknownReasonSnapshot" VARCHAR(1000),
  "resolvedByUserId" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "notification_outbox_recoveries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "operational_alert_outbox_recoveries" (
  "id" UUID NOT NULL,
  "eventId" UUID NOT NULL,
  "resolution" "NotificationOutboxRecoveryResolution" NOT NULL,
  "note" VARCHAR(1000) NOT NULL,
  "unknownReasonSnapshot" VARCHAR(1000),
  "resolvedByUserId" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "operational_alert_outbox_recoveries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "notification_outbox_recoveries_eventId_createdAt_idx"
  ON "notification_outbox_recoveries"("eventId", "createdAt");
CREATE INDEX "notification_outbox_recoveries_resolvedByUserId_createdAt_idx"
  ON "notification_outbox_recoveries"("resolvedByUserId", "createdAt");
CREATE INDEX "operational_alert_outbox_recoveries_eventId_createdAt_idx"
  ON "operational_alert_outbox_recoveries"("eventId", "createdAt");
CREATE INDEX "operational_alert_outbox_recoveries_resolvedByUserId_createdAt_idx"
  ON "operational_alert_outbox_recoveries"("resolvedByUserId", "createdAt");

ALTER TABLE "notification_outbox_recoveries"
  ADD CONSTRAINT "notification_outbox_recoveries_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "notification_outbox_events"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "notification_outbox_recoveries_resolvedByUserId_fkey"
  FOREIGN KEY ("resolvedByUserId") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "operational_alert_outbox_recoveries"
  ADD CONSTRAINT "operational_alert_outbox_recoveries_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "operational_alert_outbox_events"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "operational_alert_outbox_recoveries_resolvedByUserId_fkey"
  FOREIGN KEY ("resolvedByUserId") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
