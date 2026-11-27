ALTER TYPE "CampaignBannerSlot" ADD VALUE 'COUNTDOWN';
ALTER TYPE "CampaignBannerSlot" ADD VALUE 'NAVIGATION';

CREATE TYPE "CampaignNavigationEffect" AS ENUM ('SOLID', 'GRADIENT', 'ANIMATED');

ALTER TABLE "campaign_placements"
    ADD COLUMN "mediaId" UUID REFERENCES "media"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD COLUMN "mobileMediaId" UUID REFERENCES "media"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD COLUMN "stillMediaId" UUID REFERENCES "media"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD COLUMN "desktopHeight" INTEGER CHECK ("desktopHeight" BETWEEN 48 AND 320),
    ADD COLUMN "mobileHeight" INTEGER CHECK ("mobileHeight" BETWEEN 48 AND 320),
    ADD COLUMN "textColor" VARCHAR(7),
    ADD COLUMN "navigationEffect" "CampaignNavigationEffect";

ALTER TABLE "order_items"
    ADD COLUMN "campaignIdSnapshot" UUID,
    ADD COLUMN "campaignNameSnapshot" VARCHAR(150),
    ADD CONSTRAINT "order_items_campaign_snapshot_check"
        CHECK (("campaignIdSnapshot" IS NULL) = ("campaignNameSnapshot" IS NULL));
