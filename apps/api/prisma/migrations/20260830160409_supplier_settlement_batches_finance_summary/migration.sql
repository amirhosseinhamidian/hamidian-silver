-- CreateEnum
CREATE TYPE "SupplierSettlementStatus" AS ENUM ('DRAFT', 'PAID', 'CANCELLED');

-- AlterTable
ALTER TABLE "supplier_payables" ADD COLUMN     "settlementId" UUID;

-- CreateTable
CREATE TABLE "supplier_settlements" (
    "id" UUID NOT NULL,
    "supplierIdSnapshot" UUID NOT NULL,
    "supplierNameSnapshot" VARCHAR(150) NOT NULL,
    "status" "SupplierSettlementStatus" NOT NULL DEFAULT 'DRAFT',
    "totalAmountToman" INTEGER NOT NULL,
    "payableCount" INTEGER NOT NULL,
    "createdByUserId" UUID,
    "paidByUserId" UUID,
    "cancelledByUserId" UUID,
    "note" VARCHAR(1000),
    "paymentReference" VARCHAR(255),
    "paidAt" TIMESTAMPTZ(3),
    "cancelledAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "supplier_settlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_settlement_items" (
    "id" UUID NOT NULL,
    "settlementId" UUID NOT NULL,
    "payableId" UUID NOT NULL,
    "amountToman" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_settlement_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "supplier_settlements_status_createdAt_idx" ON "supplier_settlements"("status", "createdAt");

-- CreateIndex
CREATE INDEX "supplier_settlements_supplierIdSnapshot_status_createdAt_idx" ON "supplier_settlements"("supplierIdSnapshot", "status", "createdAt");

-- CreateIndex
CREATE INDEX "supplier_settlements_createdByUserId_idx" ON "supplier_settlements"("createdByUserId");

-- CreateIndex
CREATE INDEX "supplier_settlements_paidByUserId_idx" ON "supplier_settlements"("paidByUserId");

-- CreateIndex
CREATE INDEX "supplier_settlements_cancelledByUserId_idx" ON "supplier_settlements"("cancelledByUserId");

-- CreateIndex
CREATE INDEX "supplier_settlement_items_payableId_idx" ON "supplier_settlement_items"("payableId");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_settlement_items_settlementId_payableId_key" ON "supplier_settlement_items"("settlementId", "payableId");

-- CreateIndex
CREATE INDEX "supplier_payables_settlementId_idx" ON "supplier_payables"("settlementId");

-- AddForeignKey
ALTER TABLE "supplier_payables" ADD CONSTRAINT "supplier_payables_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "supplier_settlements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_settlements" ADD CONSTRAINT "supplier_settlements_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_settlements" ADD CONSTRAINT "supplier_settlements_paidByUserId_fkey" FOREIGN KEY ("paidByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_settlements" ADD CONSTRAINT "supplier_settlements_cancelledByUserId_fkey" FOREIGN KEY ("cancelledByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_settlement_items" ADD CONSTRAINT "supplier_settlement_items_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "supplier_settlements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_settlement_items" ADD CONSTRAINT "supplier_settlement_items_payableId_fkey" FOREIGN KEY ("payableId") REFERENCES "supplier_payables"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
