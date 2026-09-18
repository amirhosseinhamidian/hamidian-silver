CREATE TABLE "size_groups" (
  "id" UUID NOT NULL,
  "code" VARCHAR(50) NOT NULL,
  "name" VARCHAR(100) NOT NULL,
  "selectionLabel" VARCHAR(100) NOT NULL,
  "cartLabel" VARCHAR(50) NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  "deletedAt" TIMESTAMPTZ(3),
  CONSTRAINT "size_groups_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "size_groups_code_key" ON "size_groups"("code");
CREATE INDEX "size_groups_isActive_sortOrder_idx" ON "size_groups"("isActive", "sortOrder");
CREATE INDEX "size_groups_deletedAt_idx" ON "size_groups"("deletedAt");

INSERT INTO "size_groups"
  ("id", "code", "name", "selectionLabel", "cartLabel", "sortOrder", "isActive", "createdAt", "updatedAt")
VALUES
  ('00000000-0000-4000-8000-000000000101', 'GENERAL', 'سایزبندی عمومی', 'انتخاب سایز', 'سایز', 0, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('00000000-0000-4000-8000-000000000102', 'RING', 'سایز انگشتر', 'انتخاب سایز', 'سایز', 10, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('00000000-0000-4000-8000-000000000103', 'NECKLACE_LENGTH', 'طول گردنبند', 'انتخاب طول', 'طول', 20, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('00000000-0000-4000-8000-000000000104', 'BRACELET_LENGTH', 'طول دستبند', 'انتخاب طول', 'طول', 30, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

ALTER TABLE "sizes" ADD COLUMN "groupId" UUID;

UPDATE "sizes"
SET "groupId" = '00000000-0000-4000-8000-000000000101'
WHERE "groupId" IS NULL;

ALTER TABLE "sizes" ALTER COLUMN "groupId" SET NOT NULL;
DROP INDEX "sizes_code_key";
CREATE UNIQUE INDEX "sizes_groupId_code_key" ON "sizes"("groupId", "code");
CREATE INDEX "sizes_groupId_isActive_sortOrder_idx" ON "sizes"("groupId", "isActive", "sortOrder");

ALTER TABLE "sizes"
  ADD CONSTRAINT "sizes_groupId_fkey"
  FOREIGN KEY ("groupId") REFERENCES "size_groups"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "product_variants"
  ADD COLUMN "salePriceToman" INTEGER,
  ADD COLUMN "compareAtPriceToman" INTEGER;

ALTER TABLE "product_variants"
  ADD CONSTRAINT "product_variants_salePriceToman_check"
  CHECK ("salePriceToman" IS NULL OR "salePriceToman" >= 0),
  ADD CONSTRAINT "product_variants_compareAtPriceToman_check"
  CHECK ("compareAtPriceToman" IS NULL OR "compareAtPriceToman" >= 0),
  ADD CONSTRAINT "product_variants_compare_price_check"
  CHECK (
    "compareAtPriceToman" IS NULL OR
    "salePriceToman" IS NULL OR
    "compareAtPriceToman" > "salePriceToman"
  );
