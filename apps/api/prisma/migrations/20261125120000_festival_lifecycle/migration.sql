CREATE TYPE "CampaignKind" AS ENUM ('LEGACY', 'MARKETING', 'FESTIVAL');

ALTER TABLE "campaigns"
    ADD COLUMN "kind" "CampaignKind" NOT NULL DEFAULT 'LEGACY',
    ADD COLUMN "archivedAt" TIMESTAMPTZ(3),
    ADD CONSTRAINT "campaigns_valid_festival_archive"
        CHECK ("archivedAt" IS NULL OR ("kind" = 'FESTIVAL' AND "status" = 'ENDED'));
