-- CreateEnum
CREATE TYPE "PlatingFulfillmentStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "order_plating_fulfillments" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "status" "PlatingFulfillmentStatus" NOT NULL DEFAULT 'PENDING',
    "actualCostToman" INTEGER,
    "externalReference" VARCHAR(255),
    "startNote" VARCHAR(1000),
    "completionNote" VARCHAR(1000),
    "cancellationReason" VARCHAR(1000),
    "startedByUserId" UUID,
    "completedByUserId" UUID,
    "cancelledByUserId" UUID,
    "startedAt" TIMESTAMPTZ(3),
    "completedAt" TIMESTAMPTZ(3),
    "cancelledAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "order_plating_fulfillments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "order_plating_fulfillments_orderId_key" ON "order_plating_fulfillments"("orderId");

-- CreateIndex
CREATE INDEX "order_plating_fulfillments_status_createdAt_idx" ON "order_plating_fulfillments"("status", "createdAt");

-- CreateIndex
CREATE INDEX "order_plating_fulfillments_startedByUserId_idx" ON "order_plating_fulfillments"("startedByUserId");

-- CreateIndex
CREATE INDEX "order_plating_fulfillments_completedByUserId_idx" ON "order_plating_fulfillments"("completedByUserId");

-- CreateIndex
CREATE INDEX "order_plating_fulfillments_cancelledByUserId_idx" ON "order_plating_fulfillments"("cancelledByUserId");

-- AddForeignKey
ALTER TABLE "order_plating_fulfillments" ADD CONSTRAINT "order_plating_fulfillments_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_plating_fulfillments" ADD CONSTRAINT "order_plating_fulfillments_startedByUserId_fkey" FOREIGN KEY ("startedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_plating_fulfillments" ADD CONSTRAINT "order_plating_fulfillments_completedByUserId_fkey" FOREIGN KEY ("completedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_plating_fulfillments" ADD CONSTRAINT "order_plating_fulfillments_cancelledByUserId_fkey" FOREIGN KEY ("cancelledByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
