BEGIN;

ALTER TABLE "orders" ADD COLUMN "growthDevice" VARCHAR(12),
ADD CONSTRAINT "orders_growth_device_check" CHECK ("growthDevice" IN ('desktop', 'mobile', 'tablet'));

CREATE TABLE "growth_campaign_costs" (
    "id" UUID NOT NULL PRIMARY KEY,
    "campaignId" VARCHAR(64) NOT NULL,
    "source" VARCHAR(96) NOT NULL,
    "medium" VARCHAR(96) NOT NULL,
    "day" DATE NOT NULL,
    "amountToman" INTEGER NOT NULL CHECK ("amountToman" <> 0),
    "note" VARCHAR(160),
    "recordedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "growth_campaign_costs_campaignId_fkey" FOREIGN KEY ("campaignId")
        REFERENCES "campaign_link_identities"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "growth_campaign_costs_day_idx" ON "growth_campaign_costs"("day");
CREATE INDEX "growth_campaign_costs_campaignId_day_idx" ON "growth_campaign_costs"("campaignId", "day");

CREATE TABLE "growth_funnel_events" (
    "id" UUID NOT NULL PRIMARY KEY,
    "visitId" UUID NOT NULL,
    "stage" VARCHAR(24) NOT NULL CHECK ("stage" IN (
        'view_item_list', 'select_item', 'view_item', 'add_to_cart', 'begin_checkout'
    )),
    "device" VARCHAR(12) NOT NULL CHECK ("device" IN ('desktop', 'mobile', 'tablet')),
    "source" VARCHAR(96),
    "medium" VARCHAR(96),
    "campaign" VARCHAR(96),
    "campaignId" VARCHAR(64),
    "productSlugs" VARCHAR(180)[] NOT NULL CHECK (cardinality("productSlugs") <= 24),
    "recordedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "growth_funnel_events_recordedAt_idx" ON "growth_funnel_events"("recordedAt");

COMMIT;
