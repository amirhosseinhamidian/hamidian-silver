ALTER TYPE "PaymentAttemptStatus"
  ADD VALUE IF NOT EXISTS 'AWAITING_REVIEW' AFTER 'REDIRECTED';

ALTER TYPE "NotificationOutboxEventType"
  ADD VALUE IF NOT EXISTS 'PAYMENT_RECEIPT_SUBMITTED' AFTER 'PAYMENT_VERIFIED';

ALTER TABLE "payment_attempts"
  ADD COLUMN "receiptData" BYTEA,
  ADD COLUMN "receiptMimeType" VARCHAR(100),
  ADD COLUMN "receiptOriginalName" VARCHAR(255),
  ADD COLUMN "receiptSizeBytes" INTEGER,
  ADD COLUMN "receiptUploadedAt" TIMESTAMPTZ(3),
  ADD COLUMN "receiptVerifiedByUserId" UUID;

ALTER TABLE "payment_attempts"
  ADD CONSTRAINT "payment_attempts_receiptVerifiedByUserId_fkey"
  FOREIGN KEY ("receiptVerifiedByUserId")
  REFERENCES "users"("id")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

CREATE INDEX "payment_attempts_receiptUploadedAt_idx"
  ON "payment_attempts"("receiptUploadedAt");

CREATE INDEX "payment_attempts_receiptVerifiedByUserId_idx"
  ON "payment_attempts"("receiptVerifiedByUserId");

ALTER TABLE "payment_attempts"
  DROP CONSTRAINT IF EXISTS "payment_attempts_status_metadata_valid";

ALTER TABLE "payment_attempts"
  ADD CONSTRAINT "payment_attempts_receipt_metadata_valid"
  CHECK (
    (
      "receiptData" IS NULL
      AND "receiptMimeType" IS NULL
      AND "receiptOriginalName" IS NULL
      AND "receiptSizeBytes" IS NULL
      AND "receiptUploadedAt" IS NULL
    )
    OR
    (
      "receiptData" IS NOT NULL
      AND "receiptMimeType" IS NOT NULL
      AND "receiptOriginalName" IS NOT NULL
      AND "receiptSizeBytes" IS NOT NULL
      AND "receiptSizeBytes" > 0
      AND "receiptSizeBytes" <= 10485760
      AND "receiptUploadedAt" IS NOT NULL
    )
  ),
  ADD CONSTRAINT "payment_attempts_receipt_verifier_valid"
  CHECK (
    "receiptVerifiedByUserId" IS NULL
    OR (
      "provider" = 'card_to_card'
      AND "status" = 'VERIFIED'
      AND "receiptData" IS NOT NULL
    )
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
      AND "receiptData" IS NULL
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
      AND "receiptData" IS NULL
    )
    OR
    (
      "status" = 'AWAITING_REVIEW'
      AND "provider" = 'card_to_card'
      AND "authority" IS NULL
      AND "paymentUrl" IS NULL
      AND "providerReference" IS NULL
      AND "verifiedAt" IS NULL
      AND "failureCode" IS NULL
      AND "failureMessage" IS NULL
      AND "receiptData" IS NOT NULL
      AND "receiptVerifiedByUserId" IS NULL
    )
    OR
    (
      "status" = 'FAILED'
      AND "providerReference" IS NULL
      AND "verifiedAt" IS NULL
      AND "failureMessage" IS NOT NULL
      AND "receiptVerifiedByUserId" IS NULL
    )
    OR
    (
      "status" = 'VERIFIED'
      AND "providerReference" IS NOT NULL
      AND "verifiedAt" IS NOT NULL
      AND "failureCode" IS NULL
      AND "failureMessage" IS NULL
      AND (
        (
          "provider" = 'card_to_card'
          AND "authority" IS NULL
          AND "paymentUrl" IS NULL
          AND "receiptData" IS NOT NULL
          AND "receiptVerifiedByUserId" IS NOT NULL
        )
        OR
        (
          "provider" <> 'card_to_card'
          AND "authority" IS NOT NULL
          AND "paymentUrl" IS NOT NULL
          AND "receiptData" IS NULL
          AND "receiptVerifiedByUserId" IS NULL
        )
      )
    )
    OR
    (
      "status" IN ('RECONCILIATION_REQUIRED', 'RECONCILED')
      AND "authority" IS NOT NULL
      AND "paymentUrl" IS NOT NULL
      AND "providerReference" IS NOT NULL
      AND "verifiedAt" IS NOT NULL
      AND "failureCode" IS NULL
      AND "failureMessage" IS NULL
      AND "receiptData" IS NULL
      AND "receiptVerifiedByUserId" IS NULL
    )
  );
