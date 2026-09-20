ALTER TABLE "card_to_card_accounts"
  ADD COLUMN "ibanNumber" VARCHAR(24);

ALTER TABLE "card_to_card_accounts"
  ADD CONSTRAINT "card_to_card_accounts_iban_number_valid"
  CHECK ("ibanNumber" IS NULL OR "ibanNumber" ~ '^[0-9]{24}$');

CREATE UNIQUE INDEX "card_to_card_accounts_ibanNumber_key"
  ON "card_to_card_accounts"("ibanNumber");

-- Existing rows stay available in admin so their real IBAN can be completed.
-- The API does not expose an active account to checkout until this field is set.
