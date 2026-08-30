-- CreateEnum
CREATE TYPE "OrderCostEntryType" AS ENUM ('PAYMENT_GATEWAY_FEE', 'SHIPPING_PROVIDER', 'PLATING_SERVICE', 'MANUAL_ADJUSTMENT');

-- CreateTable
CREATE TABLE "order_cost_entries" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "type" "OrderCostEntryType" NOT NULL,
    "amountToman" INTEGER NOT NULL,
    "source" VARCHAR(64) NOT NULL,
    "externalReference" VARCHAR(255),
    "description" VARCHAR(1000),
    "idempotencyKey" VARCHAR(120) NOT NULL,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL,
    "createdByUserId" UUID,
    "reversalOfId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_cost_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "order_cost_entries_idempotencyKey_key" ON "order_cost_entries"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "order_cost_entries_reversalOfId_key" ON "order_cost_entries"("reversalOfId");

-- CreateIndex
CREATE INDEX "order_cost_entries_orderId_occurredAt_idx" ON "order_cost_entries"("orderId", "occurredAt");

-- CreateIndex
CREATE INDEX "order_cost_entries_type_occurredAt_idx" ON "order_cost_entries"("type", "occurredAt");

-- CreateIndex
CREATE INDEX "order_cost_entries_createdByUserId_idx" ON "order_cost_entries"("createdByUserId");

-- AddForeignKey
ALTER TABLE "order_cost_entries" ADD CONSTRAINT "order_cost_entries_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_cost_entries" ADD CONSTRAINT "order_cost_entries_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_cost_entries" ADD CONSTRAINT "order_cost_entries_reversalOfId_fkey" FOREIGN KEY ("reversalOfId") REFERENCES "order_cost_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
