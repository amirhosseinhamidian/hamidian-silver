ALTER TYPE "SupplierProductImportStatus" ADD VALUE 'IMPORTED';

ALTER TABLE "supplier_product_import_drafts"
ADD COLUMN "productId" UUID,
ADD COLUMN "importedAt" TIMESTAMPTZ(3),
ADD COLUMN "importedByUserId" UUID;

CREATE UNIQUE INDEX "supplier_product_import_drafts_productId_key"
ON "supplier_product_import_drafts"("productId");

CREATE INDEX "supplier_product_import_drafts_importedByUserId_idx"
ON "supplier_product_import_drafts"("importedByUserId");

ALTER TABLE "supplier_product_import_drafts"
ADD CONSTRAINT "supplier_product_import_drafts_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "supplier_product_import_drafts"
ADD CONSTRAINT "supplier_product_import_drafts_importedByUserId_fkey"
FOREIGN KEY ("importedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
