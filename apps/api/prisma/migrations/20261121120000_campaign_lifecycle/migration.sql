-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'APPROVED', 'SCHEDULED', 'ACTIVE', 'PAUSED', 'ENDED');

-- CreateTable
CREATE TABLE "campaigns" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(64) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "goal" VARCHAR(500) NOT NULL,
    "channel" VARCHAR(96) NOT NULL,
    "ownerId" UUID NOT NULL,
    "trackingId" VARCHAR(64) NOT NULL,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "allProducts" BOOLEAN NOT NULL,
    "productIds" UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
    "categoryIds" UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
    "startsAt" TIMESTAMPTZ(3) NOT NULL,
    "endsAt" TIMESTAMPTZ(3) NOT NULL,
    "budgetToman" INTEGER NOT NULL,
    "message" VARCHAR(500) NOT NULL,
    "bannerEnabled" BOOLEAN NOT NULL DEFAULT false,
    "bannerPriority" INTEGER NOT NULL DEFAULT 0,
    "mediaId" UUID,
    "ctaPath" VARCHAR(1000),
    "ctaLabel" VARCHAR(80),
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "campaigns_valid_window" CHECK ("startsAt" < "endsAt"),
    CONSTRAINT "campaigns_valid_banner" CHECK (
      "bannerPriority" BETWEEN 0 AND 100 AND ("ctaPath" IS NULL) = ("ctaLabel" IS NULL)
    ),
    CONSTRAINT "campaigns_valid_budget" CHECK ("budgetToman" >= 0),
    CONSTRAINT "campaigns_valid_scope" CHECK (
      "allProducts" = (cardinality("productIds") + cardinality("categoryIds") = 0)
    )
);

-- CreateTable
CREATE TABLE "campaign_revisions" (
    "campaignId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "action" VARCHAR(24) NOT NULL,
    "actorUserId" UUID,
    "requestId" UUID,
    "snapshot" JSONB NOT NULL,
    "recordedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campaign_revisions_pkey" PRIMARY KEY ("campaignId","version")
);

-- CreateIndex
CREATE UNIQUE INDEX "campaigns_slug_key" ON "campaigns"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "campaigns_trackingId_key" ON "campaigns"("trackingId");

-- CreateIndex
CREATE INDEX "campaigns_status_startsAt_idx" ON "campaigns"("status", "startsAt");

-- CreateIndex
CREATE INDEX "campaigns_status_endsAt_idx" ON "campaigns"("status", "endsAt");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_revisions_campaignId_requestId_key" ON "campaign_revisions"("campaignId", "requestId");

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_trackingId_fkey" FOREIGN KEY ("trackingId") REFERENCES "campaign_link_identities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "media"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_revisions" ADD CONSTRAINT "campaign_revisions_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_revisions" ADD CONSTRAINT "campaign_revisions_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

