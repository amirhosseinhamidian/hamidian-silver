CREATE TABLE "shipping_carriers" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" VARCHAR(200) NOT NULL,
  "trackingUrl" VARCHAR(1000),
  "logoMediaId" UUID,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "updatedByUserId" UUID,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "shipping_carriers_pkey" PRIMARY KEY ("id")
);

INSERT INTO "shipping_carriers" (
  "name",
  "trackingUrl",
  "logoMediaId",
  "isActive",
  "updatedByUserId",
  "createdAt",
  "updatedAt"
)
SELECT
  "carrierName",
  "carrierTrackingUrl",
  "carrierLogoMediaId",
  true,
  "updatedByUserId",
  "createdAt",
  "updatedAt"
FROM "shipping_pricing_settings"
WHERE NULLIF(BTRIM("carrierName"), '') IS NOT NULL;

CREATE INDEX "shipping_carriers_isActive_createdAt_idx"
  ON "shipping_carriers"("isActive", "createdAt");
CREATE UNIQUE INDEX "shipping_carriers_name_key" ON "shipping_carriers"("name");
CREATE INDEX "shipping_carriers_logoMediaId_idx" ON "shipping_carriers"("logoMediaId");
CREATE INDEX "shipping_carriers_updatedByUserId_idx"
  ON "shipping_carriers"("updatedByUserId");

ALTER TABLE "shipping_carriers"
  ADD CONSTRAINT "shipping_carriers_logoMediaId_fkey"
  FOREIGN KEY ("logoMediaId") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "shipping_carriers"
  ADD CONSTRAINT "shipping_carriers_updatedByUserId_fkey"
  FOREIGN KEY ("updatedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
