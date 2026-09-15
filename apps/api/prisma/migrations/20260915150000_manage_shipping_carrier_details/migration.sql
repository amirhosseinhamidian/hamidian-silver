ALTER TABLE "shipping_pricing_settings"
  ADD COLUMN "carrierName" VARCHAR(200),
  ADD COLUMN "carrierTrackingUrl" VARCHAR(1000),
  ADD COLUMN "carrierLogoMediaId" UUID;

ALTER TABLE "shipments"
  ADD COLUMN "carrierNameSnapshot" VARCHAR(200),
  ADD COLUMN "carrierTrackingUrlSnapshot" VARCHAR(1000),
  ADD COLUMN "carrierLogoMediaIdSnapshot" UUID,
  ADD COLUMN "carrierPresentationSnapshottedAt" TIMESTAMPTZ(3);

CREATE INDEX "shipping_pricing_settings_carrierLogoMediaId_idx"
  ON "shipping_pricing_settings"("carrierLogoMediaId");

CREATE INDEX "shipments_carrierLogoMediaIdSnapshot_idx"
  ON "shipments"("carrierLogoMediaIdSnapshot");

ALTER TABLE "shipping_pricing_settings"
  ADD CONSTRAINT "shipping_pricing_settings_carrierLogoMediaId_fkey"
  FOREIGN KEY ("carrierLogoMediaId") REFERENCES "media"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "shipments"
  ADD CONSTRAINT "shipments_carrierLogoMediaIdSnapshot_fkey"
  FOREIGN KEY ("carrierLogoMediaIdSnapshot") REFERENCES "media"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
