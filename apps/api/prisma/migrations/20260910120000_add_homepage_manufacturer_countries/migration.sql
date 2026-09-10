ALTER TABLE "site_settings"
  ADD COLUMN "manufacturerCountriesEnabled" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "homepage_manufacturer_countries" (
  "countryId" UUID NOT NULL,
  "priority" INTEGER NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "homepage_manufacturer_countries_pkey" PRIMARY KEY ("countryId"),
  CONSTRAINT "homepage_manufacturer_countries_priority_check" CHECK ("priority" BETWEEN 1 AND 8)
);

CREATE UNIQUE INDEX "homepage_manufacturer_countries_priority_key"
  ON "homepage_manufacturer_countries"("priority");

ALTER TABLE "homepage_manufacturer_countries"
  ADD CONSTRAINT "homepage_manufacturer_countries_countryId_fkey"
  FOREIGN KEY ("countryId") REFERENCES "countries"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
