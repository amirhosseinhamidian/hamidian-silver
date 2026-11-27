ALTER TABLE "campaigns"
    ADD COLUMN "marketingDestinationPath" VARCHAR(1000),
    ADD COLUMN "relatedFestivalId" UUID,
    ADD COLUMN "relatedSalesCampaignId" UUID,
    ADD CONSTRAINT "campaigns_relatedFestivalId_fkey"
        FOREIGN KEY ("relatedFestivalId") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT "campaigns_relatedSalesCampaignId_fkey"
        FOREIGN KEY ("relatedSalesCampaignId") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT "campaigns_marketing_settings_valid" CHECK (
        ("marketingDestinationPath" IS NULL AND "relatedFestivalId" IS NULL AND "relatedSalesCampaignId" IS NULL)
        OR (
            "marketingDestinationPath" IS NOT NULL AND "kind" = 'MARKETING' AND "managementPurpose" IS NULL
            AND "plannedChannelCostToman" IS NOT NULL AND "plannedChannelCostToman" = "budgetToman"
            AND "marketingDestinationPath" LIKE '/%' AND "allProducts" AND "audience" = 'ALL_CUSTOMERS'
            AND NOT "bannerEnabled" AND "bannerPriority" = 0 AND "mediaId" IS NULL
            AND "ctaPath" IS NULL AND "ctaLabel" IS NULL
            AND "relatedFestivalId" IS DISTINCT FROM "id" AND "relatedSalesCampaignId" IS DISTINCT FROM "id"
        )
    );

CREATE INDEX "campaigns_relatedFestivalId_idx" ON "campaigns"("relatedFestivalId");
CREATE INDEX "campaigns_relatedSalesCampaignId_idx" ON "campaigns"("relatedSalesCampaignId");
