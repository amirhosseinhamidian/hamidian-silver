-- Stage 092: isolate shipping tracking attempts across workers and stale provider responses.

ALTER TABLE "shipments"
  ADD COLUMN "trackingSyncToken" UUID,
  ADD COLUMN "trackingSyncStartedAt" TIMESTAMPTZ(3);

ALTER TABLE "shipments"
  ADD CONSTRAINT "shipments_tracking_sync_lease_valid"
  CHECK (
    ("trackingSyncToken" IS NULL AND "trackingSyncStartedAt" IS NULL)
    OR
    ("trackingSyncToken" IS NOT NULL AND "trackingSyncStartedAt" IS NOT NULL)
  );

CREATE INDEX "shipments_trackingSyncStartedAt_idx"
  ON "shipments"("trackingSyncStartedAt");
