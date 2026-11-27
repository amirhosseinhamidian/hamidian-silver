-- CreateEnum
CREATE TYPE "CampaignLandingMode" AS ENUM ('TEMPORARY', 'RECURRING');

-- CreateEnum
CREATE TYPE "CampaignCollectionMode" AS ENUM ('FILTERED', 'MANUAL');

-- CreateEnum
CREATE TYPE "CampaignBannerSlot" AS ENUM ('HOME', 'CATEGORY', 'PRODUCT');

-- CreateTable
CREATE TABLE "campaign_landings" (
    "campaignId" UUID NOT NULL,
    "slug" VARCHAR(64) NOT NULL,
    "seoMode" "CampaignLandingMode" NOT NULL,
    "title" VARCHAR(150) NOT NULL,
    "story" VARCHAR(3000) NOT NULL,
    "collectionMode" "CampaignCollectionMode" NOT NULL,
    "filters" JSONB NOT NULL,
    "manualProductIds" UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "campaign_landings_pkey" PRIMARY KEY ("campaignId")
);

-- CreateTable
CREATE TABLE "campaign_placements" (
    "campaignId" UUID NOT NULL,
    "slot" "CampaignBannerSlot" NOT NULL,
    "targetId" UUID,
    "priority" INTEGER NOT NULL,
    "startsAt" TIMESTAMPTZ(3),
    "endsAt" TIMESTAMPTZ(3),

    CONSTRAINT "campaign_placements_pkey" PRIMARY KEY ("campaignId","slot")
);

-- CreateIndex
CREATE INDEX "campaign_landings_slug_seoMode_idx" ON "campaign_landings"("slug", "seoMode");

-- CreateIndex
CREATE INDEX "campaign_placements_slot_targetId_priority_idx" ON "campaign_placements"("slot", "targetId", "priority");

-- AddForeignKey
ALTER TABLE "campaign_landings" ADD CONSTRAINT "campaign_landings_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_placements" ADD CONSTRAINT "campaign_placements_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaign_landings"("campaignId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "campaign_landings"
  ADD CONSTRAINT "campaign_landings_collection_valid" CHECK (
    "slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    AND (CASE WHEN "collectionMode" = 'MANUAL'
      THEN cardinality("manualProductIds") BETWEEN 1 AND 48 ELSE cardinality("manualProductIds") = 0 END)
  );

ALTER TABLE "campaign_placements"
  ADD CONSTRAINT "campaign_placements_scope_valid" CHECK (
    "priority" BETWEEN 0 AND 100
    AND ("slot" <> 'HOME' OR "targetId" IS NULL)
    AND ("startsAt" IS NULL OR "endsAt" IS NULL OR "startsAt" < "endsAt")
  );
