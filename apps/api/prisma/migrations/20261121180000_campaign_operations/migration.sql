CREATE TYPE "CampaignAudience" AS ENUM ('ALL_CUSTOMERS', 'FIRST_PURCHASE', 'RETURNING');

ALTER TABLE "campaigns"
  ADD COLUMN "plannedChannelCostToman" INTEGER,
  ADD COLUMN "audience" "CampaignAudience" NOT NULL DEFAULT 'ALL_CUSTOMERS',
  ADD CONSTRAINT "campaigns_planned_channel_cost_valid"
    CHECK ("plannedChannelCostToman" >= 0 AND "plannedChannelCostToman" <= "budgetToman");
