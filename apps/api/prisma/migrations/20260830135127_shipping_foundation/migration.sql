-- CreateEnum
CREATE TYPE "ShipmentStatus" AS ENUM ('PENDING', 'READY', 'HANDED_OVER', 'IN_TRANSIT', 'DELIVERED', 'FAILED', 'CANCELLED');

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "unitWeightGrams" DECIMAL(10,3);

-- CreateTable
CREATE TABLE "shipments" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "provider" VARCHAR(64) NOT NULL,
    "providerServiceCode" VARCHAR(120) NOT NULL,
    "providerServiceName" VARCHAR(200),
    "status" "ShipmentStatus" NOT NULL DEFAULT 'PENDING',
    "shippingCostToman" INTEGER NOT NULL,
    "totalWeightGrams" DECIMAL(12,3) NOT NULL,
    "estimatedDeliveryDays" INTEGER,
    "providerShipmentId" VARCHAR(255),
    "trackingCode" VARCHAR(255),
    "shippedAt" TIMESTAMPTZ(3),
    "deliveredAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "shipments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipment_status_history" (
    "id" UUID NOT NULL,
    "shipmentId" UUID NOT NULL,
    "actorUserId" UUID,
    "fromStatus" "ShipmentStatus",
    "toStatus" "ShipmentStatus" NOT NULL,
    "reason" VARCHAR(500),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shipment_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "shipments_orderId_key" ON "shipments"("orderId");

-- CreateIndex
CREATE INDEX "shipments_status_createdAt_idx" ON "shipments"("status", "createdAt");

-- CreateIndex
CREATE INDEX "shipments_provider_providerShipmentId_idx" ON "shipments"("provider", "providerShipmentId");

-- CreateIndex
CREATE INDEX "shipments_trackingCode_idx" ON "shipments"("trackingCode");

-- CreateIndex
CREATE INDEX "shipment_status_history_shipmentId_createdAt_idx" ON "shipment_status_history"("shipmentId", "createdAt");

-- CreateIndex
CREATE INDEX "shipment_status_history_actorUserId_idx" ON "shipment_status_history"("actorUserId");

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_status_history" ADD CONSTRAINT "shipment_status_history_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_status_history" ADD CONSTRAINT "shipment_status_history_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
