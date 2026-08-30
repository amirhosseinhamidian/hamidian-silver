-- AlterTable
ALTER TABLE "products" ADD COLUMN     "salePriceToman" INTEGER;

-- CreateTable
CREATE TABLE "suppliers" (
    "id" UUID NOT NULL,
    "code" VARCHAR(64) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "contactName" VARCHAR(150),
    "phone" VARCHAR(20),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_suppliers" (
    "productId" UUID NOT NULL,
    "supplierId" UUID NOT NULL,
    "supplierPriceToman" INTEGER NOT NULL,
    "markupPercent" DECIMAL(7,3),
    "isPreferred" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "product_suppliers_pkey" PRIMARY KEY ("productId","supplierId")
);

-- CreateTable
CREATE TABLE "product_price_history" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "changedByUserId" UUID,
    "previousPriceToman" INTEGER,
    "newPriceToman" INTEGER NOT NULL,
    "reason" VARCHAR(500),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_price_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_code_key" ON "suppliers"("code");

-- CreateIndex
CREATE INDEX "suppliers_isActive_idx" ON "suppliers"("isActive");

-- CreateIndex
CREATE INDEX "suppliers_deletedAt_idx" ON "suppliers"("deletedAt");

-- CreateIndex
CREATE INDEX "product_suppliers_supplierId_isActive_idx" ON "product_suppliers"("supplierId", "isActive");

-- CreateIndex
CREATE INDEX "product_suppliers_productId_isPreferred_idx" ON "product_suppliers"("productId", "isPreferred");

-- CreateIndex
CREATE INDEX "product_price_history_productId_createdAt_idx" ON "product_price_history"("productId", "createdAt");

-- CreateIndex
CREATE INDEX "product_price_history_changedByUserId_idx" ON "product_price_history"("changedByUserId");

-- AddForeignKey
ALTER TABLE "product_suppliers" ADD CONSTRAINT "product_suppliers_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_suppliers" ADD CONSTRAINT "product_suppliers_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_price_history" ADD CONSTRAINT "product_price_history_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_price_history" ADD CONSTRAINT "product_price_history_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
