ALTER TABLE "products"
ADD COLUMN "defaultPlatingType" "PlatingType";

CREATE TABLE "product_relations" (
  "sourceProductId" UUID NOT NULL,
  "targetProductId" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "product_relations_pkey" PRIMARY KEY ("sourceProductId", "targetProductId"),
  CONSTRAINT "product_relations_distinct_products_check" CHECK ("sourceProductId" < "targetProductId")
);

CREATE INDEX "product_relations_targetProductId_idx"
ON "product_relations"("targetProductId");

ALTER TABLE "product_relations"
ADD CONSTRAINT "product_relations_sourceProductId_fkey"
FOREIGN KEY ("sourceProductId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "product_relations"
ADD CONSTRAINT "product_relations_targetProductId_fkey"
FOREIGN KEY ("targetProductId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
