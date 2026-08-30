-- CreateEnum
CREATE TYPE "InventoryMovementType" AS ENUM ('ADJUSTMENT', 'RECEIPT', 'RESERVATION', 'RELEASE', 'SALE', 'RETURN', 'CANCELLATION');

-- CreateTable
CREATE TABLE "warehouses" (
    "id" UUID NOT NULL,
    "code" VARCHAR(64) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory" (
    "id" UUID NOT NULL,
    "warehouseId" UUID NOT NULL,
    "variantId" UUID NOT NULL,
    "onHand" INTEGER NOT NULL DEFAULT 0,
    "reserved" INTEGER NOT NULL DEFAULT 0,
    "lowStockThreshold" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_movements" (
    "id" UUID NOT NULL,
    "inventoryId" UUID NOT NULL,
    "actorUserId" UUID,
    "type" "InventoryMovementType" NOT NULL,
    "onHandDelta" INTEGER NOT NULL DEFAULT 0,
    "reservedDelta" INTEGER NOT NULL DEFAULT 0,
    "onHandAfter" INTEGER NOT NULL,
    "reservedAfter" INTEGER NOT NULL,
    "reason" VARCHAR(500),
    "referenceType" VARCHAR(64),
    "referenceId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "warehouses_code_key" ON "warehouses"("code");

-- CreateIndex
CREATE INDEX "warehouses_isActive_idx" ON "warehouses"("isActive");

-- CreateIndex
CREATE INDEX "warehouses_deletedAt_idx" ON "warehouses"("deletedAt");

-- CreateIndex
CREATE INDEX "inventory_variantId_idx" ON "inventory"("variantId");

-- CreateIndex
CREATE INDEX "inventory_warehouseId_onHand_idx" ON "inventory"("warehouseId", "onHand");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_warehouseId_variantId_key" ON "inventory"("warehouseId", "variantId");

-- CreateIndex
CREATE INDEX "inventory_movements_inventoryId_createdAt_idx" ON "inventory_movements"("inventoryId", "createdAt");

-- CreateIndex
CREATE INDEX "inventory_movements_actorUserId_idx" ON "inventory_movements"("actorUserId");

-- CreateIndex
CREATE INDEX "inventory_movements_referenceType_referenceId_idx" ON "inventory_movements"("referenceType", "referenceId");

-- AddForeignKey
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "inventory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
