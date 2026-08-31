-- Stage 089: harden customer-refund lifecycle and external-reference integrity.
-- Prisma does not model these partial indexes or CHECK refinements in schema.prisma.

ALTER TABLE "payment_refunds"
  DROP CONSTRAINT "payment_refunds_lifecycle_valid",
  ADD CONSTRAINT "payment_refunds_lifecycle_valid"
  CHECK (
    (
      "status" = 'PENDING'
      AND "confirmedAt" IS NULL
      AND "confirmedByUserId" IS NULL
      AND "cancelledAt" IS NULL
      AND "cancelledByUserId" IS NULL
      AND "externalReference" IS NULL
      AND "resolutionNote" IS NULL
    )
    OR
    (
      "status" = 'CONFIRMED'
      AND "confirmedAt" IS NOT NULL
      AND "confirmedByUserId" IS NOT NULL
      AND "externalReference" IS NOT NULL
      AND "cancelledAt" IS NULL
      AND "cancelledByUserId" IS NULL
    )
    OR
    (
      "status" = 'CANCELLED'
      AND "cancelledAt" IS NOT NULL
      AND "cancelledByUserId" IS NOT NULL
      AND "confirmedAt" IS NULL
      AND "confirmedByUserId" IS NULL
      AND "externalReference" IS NULL
    )
    OR
    "status" = 'FAILED'
  );

CREATE UNIQUE INDEX "payment_refunds_confirmed_provider_external_reference_key"
  ON "payment_refunds" ("providerSnapshot", "externalReference")
  WHERE
    "status" = 'CONFIRMED'
    AND "providerSnapshot" IS NOT NULL
    AND "externalReference" IS NOT NULL;
