ALTER TABLE "campaign_landings" ADD COLUMN "design" JSONB;

CREATE TABLE "festival_theme_templates" (
    "name" VARCHAR(80) PRIMARY KEY,
    "theme" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "festival_design_assets" (
    "campaignId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "mediaId" UUID NOT NULL REFERENCES "media"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "festival_design_assets_pkey" PRIMARY KEY ("campaignId", "version", "mediaId"),
    CONSTRAINT "festival_design_assets_campaignId_version_fkey"
      FOREIGN KEY ("campaignId", "version") REFERENCES "campaign_revisions"("campaignId", "version")
      ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "festival_design_assets_mediaId_idx" ON "festival_design_assets"("mediaId");
