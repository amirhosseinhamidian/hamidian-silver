-- CreateEnum
CREATE TYPE "OrderReturnStatus" AS ENUM ('REQUESTED', 'RECEIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OrderReturnDisposition" AS ENUM ('RESTOCK', 'RETURN_TO_SUPPLIER');

-- CreateEnum
CREATE TYPE "SupplierCreditStatus" AS ENUM ('AVAILABLE', 'APPLIED', 'VOIDED');

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "returnAllocatedQuantity" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "returnedQuantity" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "order_returns" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "status" "OrderReturnStatus" NOT NULL DEFAULT 'REQUESTED',
    "reason" VARCHAR(1000),
    "receiveNote" VARCHAR(1000),
    "cancelReason" VARCHAR(1000),
    "requestedByUserId" UUID,
    "receivedByUserId" UUID,
    "cancelledByUserId" UUID,
    "receivedAt" TIMESTAMPTZ(3),
    "cancelledAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "order_returns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_return_items" (
    "id" UUID NOT NULL,
    "returnId" UUID NOT NULL,
    "orderItemId" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "disposition" "OrderReturnDisposition",
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "order_return_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_credits" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "orderItemId" UUID NOT NULL,
    "returnItemId" UUID NOT NULL,
    "supplierIdSnapshot" UUID NOT NULL,
    "supplierNameSnapshot" VARCHAR(150) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitSupplierPriceToman" INTEGER NOT NULL,
    "amountToman" INTEGER NOT NULL,
    "status" "SupplierCreditStatus" NOT NULL DEFAULT 'AVAILABLE',
    "createdByUserId" UUID,
    "appliedAt" TIMESTAMPTZ(3),
    "voidedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "supplier_credits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "order_returns_orderId_createdAt_idx" ON "order_returns"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "order_returns_status_createdAt_idx" ON "order_returns"("status", "createdAt");

-- CreateIndex
CREATE INDEX "order_returns_requestedByUserId_idx" ON "order_returns"("requestedByUserId");

-- CreateIndex
CREATE INDEX "order_returns_receivedByUserId_idx" ON "order_returns"("receivedByUserId");

-- CreateIndex
CREATE INDEX "order_returns_cancelledByUserId_idx" ON "order_returns"("cancelledByUserId");

-- CreateIndex
CREATE INDEX "order_return_items_orderItemId_idx" ON "order_return_items"("orderItemId");

-- CreateIndex
CREATE UNIQUE INDEX "order_return_items_returnId_orderItemId_key" ON "order_return_items"("returnId", "orderItemId");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_credits_returnItemId_key" ON "supplier_credits"("returnItemId");

-- CreateIndex
CREATE INDEX "supplier_credits_supplierIdSnapshot_status_createdAt_idx" ON "supplier_credits"("supplierIdSnapshot", "status", "createdAt");

-- CreateIndex
CREATE INDEX "supplier_credits_orderId_createdAt_idx" ON "supplier_credits"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "supplier_credits_orderItemId_idx" ON "supplier_credits"("orderItemId");

-- CreateIndex
CREATE INDEX "supplier_credits_createdByUserId_idx" ON "supplier_credits"("createdByUserId");

-- AddForeignKey
ALTER TABLE "order_returns" ADD CONSTRAINT "order_returns_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_returns" ADD CONSTRAINT "order_returns_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_returns" ADD CONSTRAINT "order_returns_receivedByUserId_fkey" FOREIGN KEY ("receivedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_returns" ADD CONSTRAINT "order_returns_cancelledByUserId_fkey" FOREIGN KEY ("cancelledByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_return_items" ADD CONSTRAINT "order_return_items_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "order_returns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_return_items" ADD CONSTRAINT "order_return_items_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_credits" ADD CONSTRAINT "supplier_credits_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_credits" ADD CONSTRAINT "supplier_credits_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_credits" ADD CONSTRAINT "supplier_credits_returnItemId_fkey" FOREIGN KEY ("returnItemId") REFERENCES "order_return_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_credits" ADD CONSTRAINT "supplier_credits_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
