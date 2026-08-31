-- Stage 072: enforce supplier payable, settlement, and credit lifecycle invariants.
-- Prisma does not model these CHECK constraints in schema.prisma.

ALTER TABLE "supplier_payables"
  ADD CONSTRAINT "supplier_payables_lifecycle_valid"
  CHECK (
    (
      "status" = 'OPEN'
      AND "paidAt" IS NULL
      AND "paymentReference" IS NULL
    )
    OR
    (
      "status" = 'PAID'
      AND "paidAt" IS NOT NULL
    )
  );

ALTER TABLE "supplier_settlements"
  ADD CONSTRAINT "supplier_settlements_lifecycle_valid"
  CHECK (
    (
      "status" = 'DRAFT'
      AND "paidAt" IS NULL
      AND "cancelledAt" IS NULL
      AND "paidAmountToman" IS NULL
    )
    OR
    (
      "status" = 'PAID'
      AND "paidAt" IS NOT NULL
      AND "cancelledAt" IS NULL
      AND "paidAmountToman" IS NOT NULL
      AND "paidAmountToman"::bigint + "creditAppliedToman"::bigint
        = "totalAmountToman"::bigint
    )
    OR
    (
      "status" = 'CANCELLED'
      AND "paidAt" IS NULL
      AND "cancelledAt" IS NOT NULL
      AND "paidAmountToman" IS NULL
      AND "creditAppliedToman" = 0
    )
  );

ALTER TABLE "supplier_credits"
  ADD CONSTRAINT "supplier_credits_state_matches_balance"
  CHECK (
    (
      "status" = 'AVAILABLE'
      AND "appliedAmountToman" = 0
      AND "appliedAt" IS NULL
    )
    OR
    (
      "status" = 'PARTIALLY_APPLIED'
      AND "appliedAmountToman" > 0
      AND "appliedAmountToman" < "amountToman"
      AND "appliedAt" IS NULL
    )
    OR
    (
      "status" = 'APPLIED'
      AND "appliedAmountToman" = "amountToman"
      AND "appliedAt" IS NOT NULL
    )
    OR
    (
      "status" = 'VOIDED'
      AND "appliedAt" IS NULL
    )
  );

ALTER TABLE "supplier_credit_applications"
  ADD CONSTRAINT "supplier_credit_applications_lifecycle_valid"
  CHECK (
    (
      "status" = 'ACTIVE'
      AND "removedAt" IS NULL
    )
    OR
    (
      "status" = 'REMOVED'
      AND "removedAt" IS NOT NULL
    )
  );
