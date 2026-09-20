ALTER TABLE "shipping_carriers"
  ADD COLUMN "pricingMode" VARCHAR(16) NOT NULL DEFAULT 'FREE',
  ADD COLUMN "baseCostToman" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "thresholdToman" INTEGER,
  ADD COLUMN "discountedCostToman" INTEGER,
  ADD COLUMN "serviceArea" VARCHAR(16) NOT NULL DEFAULT 'NATIONWIDE';

UPDATE "shipping_carriers" AS carrier
SET
  "pricingMode" = CASE WHEN settings."mode" = 'FIXED' THEN 'FIXED' ELSE 'FREE' END,
  "baseCostToman" = CASE WHEN settings."mode" = 'FIXED' THEN settings."baseCostToman" ELSE 0 END,
  "thresholdToman" = CASE WHEN settings."mode" = 'FIXED' THEN settings."thresholdToman" ELSE NULL END,
  "discountedCostToman" = CASE WHEN settings."mode" = 'FIXED' THEN settings."discountedCostToman" ELSE NULL END
FROM "shipping_pricing_settings" AS settings
WHERE settings."id" = 'shipping';

ALTER TABLE "shipping_carriers"
  ADD CONSTRAINT "shipping_carriers_pricing_mode_check"
    CHECK ("pricingMode" IN ('FREE', 'FIXED', 'COLLECT')),
  ADD CONSTRAINT "shipping_carriers_service_area_check"
    CHECK ("serviceArea" IN ('NATIONWIDE', 'TEHRAN_ONLY')),
  ADD CONSTRAINT "shipping_carriers_pricing_values_check"
    CHECK (
      ("pricingMode" = 'FREE' AND "baseCostToman" = 0 AND "thresholdToman" IS NULL AND "discountedCostToman" IS NULL)
      OR
      ("pricingMode" = 'COLLECT' AND "serviceArea" = 'TEHRAN_ONLY' AND "baseCostToman" = 0 AND "thresholdToman" IS NULL AND "discountedCostToman" IS NULL)
      OR
      (
        "pricingMode" = 'FIXED'
        AND "baseCostToman" > 0
        AND (
          ("thresholdToman" IS NULL AND "discountedCostToman" IS NULL)
          OR
          ("thresholdToman" > 0 AND "discountedCostToman" >= 0 AND "discountedCostToman" < "baseCostToman")
        )
      )
    );

ALTER TABLE "orders"
  ADD COLUMN "shippingCarrierIdSnapshot" UUID,
  ADD COLUMN "shippingCarrierNameSnapshot" VARCHAR(200),
  ADD COLUMN "shippingCarrierTrackingUrlSnapshot" VARCHAR(1000),
  ADD COLUMN "shippingCarrierLogoMediaIdSnapshot" UUID,
  ADD COLUMN "shippingPricingModeSnapshot" VARCHAR(16),
  ADD COLUMN "shippingServiceAreaSnapshot" VARCHAR(16);

CREATE INDEX "orders_shippingCarrierLogoMediaIdSnapshot_idx"
  ON "orders"("shippingCarrierLogoMediaIdSnapshot");

ALTER TABLE "orders"
  ADD CONSTRAINT "orders_shippingCarrierLogoMediaIdSnapshot_fkey"
  FOREIGN KEY ("shippingCarrierLogoMediaIdSnapshot") REFERENCES "media"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
