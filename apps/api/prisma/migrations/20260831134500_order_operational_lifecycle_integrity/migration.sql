-- Stage 082: enforce order operational status metadata and chronology.
-- Prisma does not model these CHECK constraints in schema.prisma.
--
-- Stage 063 requires timestamps when an order reaches paid/delivered/cancelled
-- states. These constraints also prevent stale timestamps from remaining on
-- incompatible states and validate the durable order timeline.

ALTER TABLE "orders"
  ADD CONSTRAINT "orders_status_metadata_exclusive"
  CHECK (
    (
      "status" = 'PENDING_PAYMENT'
      AND "paidAt" IS NULL
      AND "cancelledAt" IS NULL
      AND "deliveredAt" IS NULL
    )
    OR
    (
      "status" IN ('PAID', 'PROCESSING', 'SHIPPED')
      AND "paidAt" IS NOT NULL
      AND "cancelledAt" IS NULL
      AND "deliveredAt" IS NULL
    )
    OR
    (
      "status" = 'DELIVERED'
      AND "paidAt" IS NOT NULL
      AND "cancelledAt" IS NULL
      AND "deliveredAt" IS NOT NULL
    )
    OR
    (
      "status" = 'CANCELLED'
      AND "cancelledAt" IS NOT NULL
      AND "deliveredAt" IS NULL
    )
    OR
    (
      "status" = 'EXPIRED'
      AND "paidAt" IS NULL
      AND "cancelledAt" IS NULL
      AND "deliveredAt" IS NULL
    )
  ),
  ADD CONSTRAINT "orders_operational_timeline_valid"
  CHECK (
    "reservationExpiresAt" >= "createdAt"
    AND ("paidAt" IS NULL OR "paidAt" >= "createdAt")
    AND ("cancelledAt" IS NULL OR "cancelledAt" >= "createdAt")
    AND ("deliveredAt" IS NULL OR "deliveredAt" >= "createdAt")
    AND (
      "deliveredAt" IS NULL
      OR (
        "paidAt" IS NOT NULL
        AND "deliveredAt" >= "paidAt"
      )
    )
    AND (
      "cancelledAt" IS NULL
      OR "paidAt" IS NULL
      OR "cancelledAt" >= "paidAt"
    )
  );

ALTER TABLE "order_status_history"
  ADD CONSTRAINT "order_status_history_transition_valid"
  CHECK (
    (
      "fromStatus" IS NULL
      AND "toStatus" = 'PENDING_PAYMENT'
    )
    OR
    (
      "fromStatus" IS NOT NULL
      AND "fromStatus" <> "toStatus"
    )
  );
