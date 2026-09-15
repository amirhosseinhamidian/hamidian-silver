CREATE TABLE "shipping_pricing_settings" (
    "id" VARCHAR(32) NOT NULL DEFAULT 'shipping',
    "mode" VARCHAR(16) NOT NULL,
    "baseCostToman" INTEGER NOT NULL,
    "thresholdToman" INTEGER,
    "discountedCostToman" INTEGER,
    "updatedByUserId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "shipping_pricing_settings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "shipping_pricing_settings_mode_check" CHECK ("mode" IN ('FREE', 'FIXED')),
    CONSTRAINT "shipping_pricing_settings_base_cost_check" CHECK (
      ("mode" = 'FREE' AND "baseCostToman" = 0) OR
      ("mode" = 'FIXED' AND "baseCostToman" > 0)
    ),
    CONSTRAINT "shipping_pricing_settings_threshold_pair_check" CHECK (
      ("thresholdToman" IS NULL) = ("discountedCostToman" IS NULL)
    ),
    CONSTRAINT "shipping_pricing_settings_threshold_values_check" CHECK (
      ("thresholdToman" IS NULL AND "discountedCostToman" IS NULL) OR
      (
        "mode" = 'FIXED' AND
        "thresholdToman" > 0 AND
        "discountedCostToman" >= 0 AND
        "discountedCostToman" < "baseCostToman"
      )
    )
);

CREATE INDEX "shipping_pricing_settings_updatedByUserId_idx"
ON "shipping_pricing_settings"("updatedByUserId");

ALTER TABLE "shipping_pricing_settings"
ADD CONSTRAINT "shipping_pricing_settings_updatedByUserId_fkey"
FOREIGN KEY ("updatedByUserId") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
