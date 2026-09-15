ALTER TYPE "PaymentStatus"
  ADD VALUE IF NOT EXISTS 'AWAITING_REVIEW' AFTER 'PENDING';

ALTER TABLE "payment_attempts"
  ADD COLUMN "receiptVerifiedAt" TIMESTAMPTZ(3);

UPDATE "payment_attempts"
SET "receiptVerifiedAt" = "verifiedAt"
WHERE "provider" = 'card_to_card'
  AND "status" = 'VERIFIED'
  AND "receiptData" IS NOT NULL;

ALTER TABLE "payment_attempts"
  ADD CONSTRAINT "payment_attempts_receipt_verification_metadata_valid"
  CHECK (
    (
      "receiptVerifiedAt" IS NULL
      AND "receiptVerifiedByUserId" IS NULL
    )
    OR
    (
      "provider" = 'card_to_card'
      AND "status" = 'VERIFIED'
      AND "receiptData" IS NOT NULL
      AND "receiptVerifiedAt" IS NOT NULL
      AND "receiptVerifiedByUserId" IS NOT NULL
    )
  );

CREATE TABLE "card_to_card_accounts" (
  "id" UUID NOT NULL,
  "cardNumber" VARCHAR(16) NOT NULL,
  "holderName" VARCHAR(150) NOT NULL,
  "bankName" VARCHAR(100) NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT false,
  "updatedByUserId" UUID,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,

  CONSTRAINT "card_to_card_accounts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "card_to_card_accounts_card_number_valid" CHECK ("cardNumber" ~ '^[0-9]{16}$'),
  CONSTRAINT "card_to_card_accounts_holder_name_valid" CHECK (char_length(btrim("holderName")) BETWEEN 2 AND 150),
  CONSTRAINT "card_to_card_accounts_bank_name_valid" CHECK (char_length(btrim("bankName")) BETWEEN 2 AND 100)
);

CREATE UNIQUE INDEX "card_to_card_accounts_cardNumber_key"
  ON "card_to_card_accounts"("cardNumber");

CREATE UNIQUE INDEX "card_to_card_accounts_single_active_key"
  ON "card_to_card_accounts"("isActive")
  WHERE "isActive" = true;

CREATE INDEX "card_to_card_accounts_isActive_idx"
  ON "card_to_card_accounts"("isActive");

CREATE INDEX "card_to_card_accounts_updatedByUserId_idx"
  ON "card_to_card_accounts"("updatedByUserId");

ALTER TABLE "card_to_card_accounts"
  ADD CONSTRAINT "card_to_card_accounts_updatedByUserId_fkey"
  FOREIGN KEY ("updatedByUserId")
  REFERENCES "users"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

UPDATE "payments" AS payment
SET "status" = 'AWAITING_REVIEW'
WHERE payment."status" = 'PENDING'
  AND EXISTS (
    SELECT 1
    FROM "payment_attempts" AS attempt
    WHERE attempt."paymentId" = payment."id"
      AND attempt."provider" = 'card_to_card'
      AND attempt."status" = 'AWAITING_REVIEW'
  );
