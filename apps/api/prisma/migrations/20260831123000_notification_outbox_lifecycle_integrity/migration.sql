-- Stage 070: enforce durable lifecycle invariants for both notification outboxes.
-- Prisma does not model these CHECK constraints in schema.prisma.

ALTER TABLE "notification_outbox_events"
  ADD CONSTRAINT "notification_outbox_events_attempts_nonnegative"
  CHECK ("attempts" >= 0),
  ADD CONSTRAINT "notification_outbox_events_lifecycle_valid"
  CHECK (
    (
      "status" = 'PENDING'
      AND "claimedAt" IS NULL
      AND "processedAt" IS NULL
    )
    OR
    (
      "status" = 'PROCESSING'
      AND "claimedAt" IS NOT NULL
      AND "processedAt" IS NULL
    )
    OR
    (
      "status" = 'SENT'
      AND "claimedAt" IS NULL
      AND "processedAt" IS NOT NULL
    )
    OR
    (
      "status" = 'FAILED'
      AND "claimedAt" IS NULL
      AND "processedAt" IS NULL
    )
  );

ALTER TABLE "operational_alert_outbox_events"
  ADD CONSTRAINT "operational_alert_outbox_events_attempts_nonnegative"
  CHECK ("attempts" >= 0),
  ADD CONSTRAINT "operational_alert_outbox_events_lifecycle_valid"
  CHECK (
    (
      "status" = 'PENDING'
      AND "claimedAt" IS NULL
      AND "processedAt" IS NULL
    )
    OR
    (
      "status" = 'PROCESSING'
      AND "claimedAt" IS NOT NULL
      AND "processedAt" IS NULL
    )
    OR
    (
      "status" = 'SENT'
      AND "claimedAt" IS NULL
      AND "processedAt" IS NOT NULL
    )
    OR
    (
      "status" = 'FAILED'
      AND "claimedAt" IS NULL
      AND "processedAt" IS NULL
    )
  );
