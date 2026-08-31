-- Stage 074: enforce full payment-attempt lifecycle metadata invariants.
-- Prisma does not model these CHECK constraints in schema.prisma.

ALTER TABLE "payment_attempts"
  ADD CONSTRAINT "payment_attempts_authority_url_pair_valid"
  CHECK (
    ("authority" IS NULL AND "paymentUrl" IS NULL)
    OR
    ("authority" IS NOT NULL AND "paymentUrl" IS NOT NULL)
  ),
  ADD CONSTRAINT "payment_attempts_status_metadata_valid"
  CHECK (
    (
      "status" = 'CREATED'
      AND "authority" IS NULL
      AND "paymentUrl" IS NULL
      AND "providerReference" IS NULL
      AND "verifiedAt" IS NULL
      AND "failureCode" IS NULL
      AND "failureMessage" IS NULL
    )
    OR
    (
      "status" = 'REDIRECTED'
      AND "authority" IS NOT NULL
      AND "paymentUrl" IS NOT NULL
      AND "providerReference" IS NULL
      AND "verifiedAt" IS NULL
      AND "failureCode" IS NULL
      AND "failureMessage" IS NULL
    )
    OR
    (
      "status" = 'FAILED'
      AND "providerReference" IS NULL
      AND "verifiedAt" IS NULL
      AND "failureMessage" IS NOT NULL
    )
    OR
    (
      "status" IN ('VERIFIED', 'RECONCILIATION_REQUIRED', 'RECONCILED')
      AND "authority" IS NOT NULL
      AND "paymentUrl" IS NOT NULL
      AND "providerReference" IS NOT NULL
      AND "verifiedAt" IS NOT NULL
      AND "failureCode" IS NULL
      AND "failureMessage" IS NULL
    )
  );
