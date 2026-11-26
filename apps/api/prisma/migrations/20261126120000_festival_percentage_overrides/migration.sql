ALTER TABLE "campaign_promotions"
  ADD COLUMN "percentageOverrides" JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE "campaign_promotions"
  ADD CONSTRAINT "campaign_promotions_percentage_overrides_array"
    CHECK (jsonb_typeof("percentageOverrides") = 'array');
