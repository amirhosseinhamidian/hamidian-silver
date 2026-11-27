CREATE TYPE "CampaignManagementPurpose" AS ENUM ('SALES');

ALTER TABLE "campaigns"
    ADD COLUMN "managementPurpose" "CampaignManagementPurpose",
    ADD CONSTRAINT "campaigns_sales_purpose_valid" CHECK (
        "managementPurpose" IS NULL OR (
            "kind" = 'LEGACY' AND "channel" = 'sales' AND "plannedChannelCostToman" IS NULL
            AND NOT "bannerEnabled" AND "bannerPriority" = 0 AND "mediaId" IS NULL
            AND "ctaPath" IS NULL AND "ctaLabel" IS NULL
        )
    );
