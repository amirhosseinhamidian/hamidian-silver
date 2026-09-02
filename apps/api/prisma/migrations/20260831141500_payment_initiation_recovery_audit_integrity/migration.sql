-- Stage 085: persist and constrain manual initiation-recovery audit metadata.
-- Prisma does not model the CHECK constraint below in schema.prisma.

-- A pre-Stage-085 abandoned recovery cannot be safely attributed after the fact.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "payment_attempts"
    WHERE "failureCode" = 'INITIATION_RECOVERY_ABANDONED'
  ) THEN
    RAISE EXCEPTION
      'Existing INITIATION_RECOVERY_ABANDONED attempts require manual audit remediation before Stage 085.';
  END IF;
END
$$;

ALTER TABLE "payment_attempts"
  ADD COLUMN "initiationRecoveryResolution" VARCHAR(32),
  ADD COLUMN "initiationRecoveryNote" VARCHAR(400),
  ADD COLUMN "initiationRecoveryResolvedByUserId" UUID,
  ADD COLUMN "initiationRecoveryResolvedAt" TIMESTAMPTZ(3);

CREATE INDEX "payment_attempts_initiationRecoveryResolvedByUserId_idx"
  ON "payment_attempts"("initiationRecoveryResolvedByUserId");

CREATE INDEX "payment_attempts_initiationRecoveryResolvedAt_idx"
  ON "payment_attempts"("initiationRecoveryResolvedAt");

ALTER TABLE "payment_attempts"
  ADD CONSTRAINT "payment_attempts_initiationRecoveryResolvedByUserId_fkey"
  FOREIGN KEY ("initiationRecoveryResolvedByUserId")
  REFERENCES "users"("id")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

ALTER TABLE "payment_attempts"
  ADD CONSTRAINT "payment_attempts_initiation_recovery_audit_valid"
  CHECK (
    (
      "initiationRecoveryResolution" IS NULL
      AND "initiationRecoveryNote" IS NULL
      AND "initiationRecoveryResolvedByUserId" IS NULL
      AND "initiationRecoveryResolvedAt" IS NULL
      AND "failureCode" IS DISTINCT FROM 'INITIATION_RECOVERY_ABANDONED'
    )
    OR
    (
      "initiationRecoveryResolution" = 'ABANDONED'
      AND "status" = 'FAILED'
      AND "authority" IS NULL
      AND "paymentUrl" IS NULL
      AND "failureCode" = 'INITIATION_RECOVERY_ABANDONED'
      AND "failureMessage" IS NOT NULL
      AND "initiationRecoveryResolvedByUserId" IS NOT NULL
      AND "initiationRecoveryResolvedAt" IS NOT NULL
      AND "initiationRecoveryResolvedAt" >= "createdAt"
    )
    OR
    (
      "initiationRecoveryResolution" = 'REDIRECTED'
      AND "status" IN ('REDIRECTED', 'VERIFIED', 'FAILED', 'RECONCILIATION_REQUIRED', 'RECONCILED')
      AND "authority" IS NOT NULL
      AND "paymentUrl" IS NOT NULL
      AND "initiationRecoveryResolvedByUserId" IS NOT NULL
      AND "initiationRecoveryResolvedAt" IS NOT NULL
      AND "initiationRecoveryResolvedAt" >= "createdAt"
    )
  );
