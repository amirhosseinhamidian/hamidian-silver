ALTER TABLE "referral_attributions"
  ADD COLUMN "referrerPurchaseOrderId" UUID REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "referral_attributions_referrerPurchaseOrderId_idx" ON "referral_attributions"("referrerPurchaseOrderId");

ALTER TABLE "orders"
  ADD COLUMN "referralCheckoutAttributionId" UUID REFERENCES "referral_attributions"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD COLUMN "referralDiscountToman" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "referralCheckoutRuleCode" VARCHAR(40),
  ADD COLUMN "referralCheckoutExpiresAt" TIMESTAMPTZ(3),
  ADD COLUMN "referralCheckoutReleasedAt" TIMESTAMPTZ(3),
  ADD CONSTRAINT "orders_referral_discount_valid" CHECK (
    ("referralDiscountToman" = 0 AND "referralCheckoutAttributionId" IS NULL
      AND "referralCheckoutRuleCode" IS NULL AND "referralCheckoutExpiresAt" IS NULL
      AND "referralCheckoutReleasedAt" IS NULL)
    OR (
      "referralDiscountToman" > 0 AND "referralDiscountToman" <= "discountTotalToman"
      AND "referralCheckoutAttributionId" IS NOT NULL AND "referralCheckoutRuleCode" IS NOT NULL
      AND "referralCheckoutExpiresAt" IS NOT NULL AND "referralCheckoutExpiresAt" > "createdAt"
      AND ("referralCheckoutReleasedAt" IS NULL OR "paidAt" IS NULL)
      AND "grandTotalToman" >= 10000
    )
  );
CREATE UNIQUE INDEX "orders_referral_live_checkout_key" ON "orders"("referralCheckoutAttributionId")
  WHERE "referralCheckoutAttributionId" IS NOT NULL AND "referralCheckoutReleasedAt" IS NULL
    AND ("paidAt" IS NOT NULL OR status NOT IN ('CANCELLED', 'EXPIRED'));
CREATE INDEX "orders_referral_checkout_attribution_idx" ON "orders"("referralCheckoutAttributionId", "createdAt")
  WHERE "referralCheckoutAttributionId" IS NOT NULL;
