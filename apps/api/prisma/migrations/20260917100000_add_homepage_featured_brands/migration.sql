CREATE TABLE "homepage_featured_brands" (
  "brandId" UUID NOT NULL,
  "priority" INTEGER NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "homepage_featured_brands_pkey" PRIMARY KEY ("brandId"),
  CONSTRAINT "homepage_featured_brands_priority_check" CHECK ("priority" BETWEEN 1 AND 4)
);

CREATE UNIQUE INDEX "homepage_featured_brands_priority_key"
  ON "homepage_featured_brands"("priority");

ALTER TABLE "homepage_featured_brands"
  ADD CONSTRAINT "homepage_featured_brands_brandId_fkey"
  FOREIGN KEY ("brandId") REFERENCES "brands"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "homepage_featured_brands" ("brandId", "priority", "createdAt", "updatedAt")
SELECT "id", "priority", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (
  SELECT "id", ROW_NUMBER() OVER (ORDER BY "name" ASC, "id" ASC)::INTEGER AS "priority"
  FROM "brands"
  WHERE "isActive" = TRUE AND "deletedAt" IS NULL
) AS "active_brands"
WHERE "priority" <= 4;
