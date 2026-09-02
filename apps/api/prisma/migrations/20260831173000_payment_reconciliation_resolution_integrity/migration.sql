-- Stage 090: make external-refund reconciliation resolution auditable and idempotent.
-- Existing historical RESOLVED rows may predate structured external refund evidence,
-- so the new lifecycle check is added NOT VALID while still enforcing future writes.

ALTER TABLE "payment_reconciliations"
  ADD COLUMN "externalReference" VARCHAR(255);

ALTER TABLE "payment_reconciliations"
  ADD CONSTRAINT "payment_reconciliations_external_refund_reference_valid"
  CHECK (
    (
      "status" = 'OPEN'
      AND "externalReference" IS NULL
    )
    OR
    (
      "status" = 'RESOLVED'
      AND "resolution" = 'REFUNDED_EXTERNALLY'
      AND "externalReference" IS NOT NULL
    )
  ) NOT VALID;

CREATE UNIQUE INDEX "payment_reconciliations_provider_externalReference_key"
  ON "payment_reconciliations" ("provider", "externalReference")
  WHERE "externalReference" IS NOT NULL;
