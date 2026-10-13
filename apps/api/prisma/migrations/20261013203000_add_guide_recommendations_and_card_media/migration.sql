CREATE TYPE "GuideProductRecommendationMode" AS ENUM ('AUTOMATIC', 'MANUAL', 'DISABLED');

-- Preserve the behavior of existing articles. New articles use AUTOMATIC after
-- this backfill-safe column addition completes.
ALTER TABLE "guide_articles"
ADD COLUMN "productRecommendationMode" "GuideProductRecommendationMode" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN "cardMediaId" UUID;

ALTER TABLE "guide_articles"
ALTER COLUMN "productRecommendationMode" SET DEFAULT 'AUTOMATIC';

CREATE INDEX "guide_articles_cardMediaId_idx" ON "guide_articles"("cardMediaId");

ALTER TABLE "guide_articles"
ADD CONSTRAINT "guide_articles_cardMediaId_fkey"
FOREIGN KEY ("cardMediaId") REFERENCES "media"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
