CREATE TYPE "CampaignQuotaAllocationState" AS ENUM ('RESERVED', 'CAPTURED', 'RELEASED');

ALTER TABLE "orders" ADD COLUMN "campaignQuotaRestricted" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "campaign_quotas" (
    "id" UUID NOT NULL,
    "campaignId" UUID NOT NULL REFERENCES "campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    "productId" UUID NOT NULL REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    "limit" INTEGER NOT NULL,
    "manualSold" INTEGER NOT NULL DEFAULT 0,
    "revision" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "campaign_quotas_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "campaign_quotas_counts_check" CHECK ("limit" > 0 AND "manualSold" BETWEEN 0 AND "limit")
);

CREATE UNIQUE INDEX "campaign_quotas_campaignId_productId_key" ON "campaign_quotas"("campaignId", "productId");
CREATE INDEX "campaign_quotas_productId_idx" ON "campaign_quotas"("productId");

CREATE TABLE "campaign_quota_allocations" (
    "quotaId" UUID NOT NULL REFERENCES "campaign_quotas"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    "orderId" UUID NOT NULL REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    "quantity" INTEGER NOT NULL CHECK ("quantity" > 0),
    "state" "CampaignQuotaAllocationState" NOT NULL DEFAULT 'RESERVED',
    CONSTRAINT "campaign_quota_allocations_pkey" PRIMARY KEY ("quotaId", "orderId")
);

CREATE INDEX "campaign_quota_allocations_orderId_idx" ON "campaign_quota_allocations"("orderId");
CREATE INDEX "campaign_quota_allocations_quotaId_state_idx" ON "campaign_quota_allocations"("quotaId", "state");

CREATE TABLE "campaign_quota_changes" (
    "quotaId" UUID NOT NULL REFERENCES "campaign_quotas"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    "revision" INTEGER NOT NULL,
    "limit" INTEGER NOT NULL,
    "manualSold" INTEGER NOT NULL,
    "actorUserId" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    "recordedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "campaign_quota_changes_pkey" PRIMARY KEY ("quotaId", "revision")
);
