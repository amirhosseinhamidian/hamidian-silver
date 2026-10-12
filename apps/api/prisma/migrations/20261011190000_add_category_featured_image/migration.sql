ALTER TABLE "categories"
ADD COLUMN "featuredImageId" UUID;

CREATE INDEX "categories_featuredImageId_idx"
ON "categories"("featuredImageId");

ALTER TABLE "categories"
ADD CONSTRAINT "categories_featuredImageId_fkey"
FOREIGN KEY ("featuredImageId") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE CASCADE;
