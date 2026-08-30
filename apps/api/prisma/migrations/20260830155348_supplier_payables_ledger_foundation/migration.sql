-- CreateEnum
CREATE TYPE "SupplierPayableStatus" AS ENUM ('OPEN', 'PAID');

-- CreateTable
CREATE TABLE "supplier_payables" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "orderItemId" UUID NOT NULL,
    "supplierIdSnapshot" UUID NOT NULL,
    "supplierNameSnapshot" VARCHAR(150) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitSupplierPriceToman" INTEGER NOT NULL,
    "amountToman" INTEGER NOT NULL,
    "status" "SupplierPayableStatus" NOT NULL DEFAULT 'OPEN',
    "paidByUserId" UUID,
    "paidAt" TIMESTAMPTZ(3),
    "paymentReference" VARCHAR(255),
    "settlementNote" VARCHAR(1000),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "supplier_payables_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "supplier_payables_orderItemId_key" ON "supplier_payables"("orderItemId");

-- CreateIndex
CREATE INDEX "supplier_payables_status_createdAt_idx" ON "supplier_payables"("status", "createdAt");

-- CreateIndex
CREATE INDEX "supplier_payables_supplierIdSnapshot_status_createdAt_idx" ON "supplier_payables"("supplierIdSnapshot", "status", "createdAt");

-- CreateIndex
CREATE INDEX "supplier_payables_orderId_idx" ON "supplier_payables"("orderId");

-- CreateIndex
CREATE INDEX "supplier_payables_paidByUserId_idx" ON "supplier_payables"("paidByUserId");

-- AddForeignKey
ALTER TABLE "supplier_payables" ADD CONSTRAINT "supplier_payables_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_payables" ADD CONSTRAINT "supplier_payables_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_payables" ADD CONSTRAINT "supplier_payables_paidByUserId_fkey" FOREIGN KEY ("paidByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
