-- Stage 063: enforce order/payment lifecycle timestamp and state invariants.
-- Prisma does not model these CHECK constraints in schema.prisma.

ALTER TABLE "orders"
  ADD CONSTRAINT "orders_paid_status_timestamp_valid"
  CHECK (
    "status" NOT IN ('PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED')
    OR "paidAt" IS NOT NULL
  ),
  ADD CONSTRAINT "orders_terminal_status_timestamps_valid"
  CHECK (
    ("status" <> 'DELIVERED' OR "deliveredAt" IS NOT NULL)
    AND ("status" <> 'CANCELLED' OR "cancelledAt" IS NOT NULL)
    AND ("deliveredAt" IS NULL OR "paidAt" IS NOT NULL)
  );

ALTER TABLE "payments"
  ADD CONSTRAINT "payments_paid_status_timestamp_valid"
  CHECK (
    "status" NOT IN ('PAID', 'PARTIALLY_REFUNDED')
    OR "paidAt" IS NOT NULL
  );

ALTER TABLE "payment_attempts"
  ADD CONSTRAINT "payment_attempts_redirect_metadata_valid"
  CHECK (
    "status" <> 'REDIRECTED'
    OR ("authority" IS NOT NULL AND "paymentUrl" IS NOT NULL)
  ),
  ADD CONSTRAINT "payment_attempts_verified_metadata_valid"
  CHECK (
    "status" NOT IN ('VERIFIED', 'RECONCILIATION_REQUIRED', 'RECONCILED')
    OR ("providerReference" IS NOT NULL AND "verifiedAt" IS NOT NULL)
  );

ALTER TABLE "payment_refunds"
  ADD CONSTRAINT "payment_refunds_lifecycle_valid"
  CHECK (
    (
      "status" = 'PENDING'
      AND "confirmedAt" IS NULL
      AND "cancelledAt" IS NULL
    )
    OR
    (
      "status" = 'CONFIRMED'
      AND "confirmedAt" IS NOT NULL
      AND "confirmedByUserId" IS NOT NULL
      AND "externalReference" IS NOT NULL
      AND "cancelledAt" IS NULL
    )
    OR
    (
      "status" = 'CANCELLED'
      AND "cancelledAt" IS NOT NULL
      AND "cancelledByUserId" IS NOT NULL
      AND "confirmedAt" IS NULL
    )
    OR
    "status" = 'FAILED'
  );

ALTER TABLE "payment_reconciliations"
  ADD CONSTRAINT "payment_reconciliations_lifecycle_valid"
  CHECK (
    (
      "status" = 'OPEN'
      AND "resolution" IS NULL
      AND "resolvedByUserId" IS NULL
      AND "resolvedAt" IS NULL
    )
    OR
    (
      "status" = 'RESOLVED'
      AND "resolution" IS NOT NULL
      AND "resolutionNote" IS NOT NULL
      AND "resolvedByUserId" IS NOT NULL
      AND "resolvedAt" IS NOT NULL
    )
  );
