-- CreateTable
CREATE TABLE "order_finance_snapshots" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "snapshotVersion" INTEGER NOT NULL DEFAULT 1,
    "paidAt" TIMESTAMPTZ(3) NOT NULL,
    "merchandiseRevenueToman" INTEGER NOT NULL,
    "platingRevenueToman" INTEGER NOT NULL,
    "discountToman" INTEGER NOT NULL,
    "shippingChargedToman" INTEGER NOT NULL,
    "taxToman" INTEGER NOT NULL,
    "customerTotalToman" INTEGER NOT NULL,
    "supplierCostToman" INTEGER NOT NULL,
    "grossSalesToman" INTEGER NOT NULL,
    "netSalesToman" INTEGER NOT NULL,
    "grossMarginBeforeServiceCostsToman" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_finance_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "order_finance_snapshots_orderId_key" ON "order_finance_snapshots"("orderId");

-- CreateIndex
CREATE INDEX "order_finance_snapshots_paidAt_idx" ON "order_finance_snapshots"("paidAt");

-- CreateIndex
CREATE INDEX "order_finance_snapshots_grossMarginBeforeServiceCostsToman__idx" ON "order_finance_snapshots"("grossMarginBeforeServiceCostsToman", "paidAt");

-- AddForeignKey
ALTER TABLE "order_finance_snapshots" ADD CONSTRAINT "order_finance_snapshots_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
