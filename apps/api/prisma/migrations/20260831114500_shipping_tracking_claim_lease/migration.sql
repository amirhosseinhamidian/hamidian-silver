-- Stage 062: make shipping tracking scheduler claims durable across API instances.

ALTER TABLE "shipments"
  ADD COLUMN "trackingAttemptedAt" TIMESTAMPTZ(3);

CREATE INDEX "shipments_status_trackingAttemptedAt_idx"
ON "shipments" ("status", "trackingAttemptedAt");
