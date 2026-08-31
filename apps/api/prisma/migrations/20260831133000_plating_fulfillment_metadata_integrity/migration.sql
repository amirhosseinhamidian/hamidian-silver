-- Stage 078: enforce plating fulfillment metadata ownership and terminal chronology.
-- Prisma does not model these CHECK constraints in schema.prisma.
--
-- Stage 056 already enforces the core status/timestamp/actual-cost lifecycle. These
-- constraints close the remaining gaps around notes, external references, and
-- terminal timestamps without requiring actor foreign keys to remain present
-- after User rows are deleted via ON DELETE SET NULL.

ALTER TABLE "order_plating_fulfillments"
  ADD CONSTRAINT "order_plating_fulfillments_metadata_state_valid"
  CHECK (
    (
      "startedAt" IS NOT NULL
      OR (
        "startedByUserId" IS NULL
        AND "startNote" IS NULL
      )
    )
    AND (
      "status" = 'COMPLETED'
      OR (
        "completedByUserId" IS NULL
        AND "completionNote" IS NULL
        AND "externalReference" IS NULL
      )
    )
    AND (
      "status" = 'CANCELLED'
      OR (
        "cancelledByUserId" IS NULL
        AND "cancellationReason" IS NULL
      )
    )
    AND (
      "status" <> 'CANCELLED'
      OR "cancellationReason" IS NOT NULL
    )
  ),
  ADD CONSTRAINT "order_plating_fulfillments_terminal_timeline_valid"
  CHECK (
    (
      "completedAt" IS NULL
      OR "startedAt" IS NULL
      OR "completedAt" >= "startedAt"
    )
    AND (
      "cancelledAt" IS NULL
      OR "startedAt" IS NULL
      OR "cancelledAt" >= "startedAt"
    )
  );
