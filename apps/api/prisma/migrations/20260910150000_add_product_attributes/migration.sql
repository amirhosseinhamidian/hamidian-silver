CREATE TABLE "product_attributes" (
  "id" UUID NOT NULL,
  "productId" UUID NOT NULL,
  "key" VARCHAR(100) NOT NULL,
  "value" VARCHAR(500) NOT NULL,
  "sortOrder" INTEGER NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "product_attributes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "product_attributes_key_not_blank" CHECK (LENGTH(BTRIM("key")) > 0),
  CONSTRAINT "product_attributes_value_not_blank" CHECK (LENGTH(BTRIM("value")) > 0),
  CONSTRAINT "product_attributes_sort_order_check" CHECK ("sortOrder" >= 1)
);

CREATE UNIQUE INDEX "product_attributes_productId_key_key"
  ON "product_attributes"("productId", "key");

CREATE UNIQUE INDEX "product_attributes_productId_sortOrder_key"
  ON "product_attributes"("productId", "sortOrder");

ALTER TABLE "product_attributes"
  ADD CONSTRAINT "product_attributes_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "products"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
