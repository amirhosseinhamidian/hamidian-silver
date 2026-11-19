BEGIN;

CREATE TYPE "AttributionModel" AS ENUM ('FIRST_NON_DIRECT', 'LAST_NON_DIRECT');

CREATE TABLE "campaign_link_identities" (
  "id" VARCHAR(64) NOT NULL,
  "campaign" VARCHAR(96) NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "campaign_link_identities_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "campaign_link_identities_campaign_key" ON "campaign_link_identities"("campaign");

CREATE TABLE "order_attributions" (
  "orderId" UUID NOT NULL,
  "policyVersion" INTEGER NOT NULL,
  "model" "AttributionModel" NOT NULL,
  "windowDays" INTEGER NOT NULL,
  "firstTouch" JSONB NOT NULL,
  "lastTouch" JSONB NOT NULL,
  "source" VARCHAR(96) NOT NULL,
  "medium" VARCHAR(96) NOT NULL,
  "campaign" VARCHAR(96),
  "content" VARCHAR(96),
  "campaignId" VARCHAR(64),
  "attributedAt" TIMESTAMPTZ(3) NOT NULL,
  "recordedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "order_attributions_pkey" PRIMARY KEY ("orderId"),
  CONSTRAINT "order_attributions_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "order_attributions_campaignId_recordedAt_idx" ON "order_attributions"("campaignId", "recordedAt");
CREATE INDEX "order_attributions_source_medium_recordedAt_idx" ON "order_attributions"("source", "medium", "recordedAt");

COMMIT;
