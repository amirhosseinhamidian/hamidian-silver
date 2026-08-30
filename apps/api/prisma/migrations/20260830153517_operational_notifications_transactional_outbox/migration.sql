-- CreateEnum
CREATE TYPE "NotificationOutboxEventType" AS ENUM ('PAYMENT_VERIFIED', 'SHIPMENT_TRACKING_AVAILABLE', 'ORDER_SHIPPED', 'ORDER_DELIVERED', 'PAYMENT_RECONCILIATION_REQUIRED');

-- CreateEnum
CREATE TYPE "NotificationOutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "notification_outbox_events" (
    "id" UUID NOT NULL,
    "type" "NotificationOutboxEventType" NOT NULL,
    "aggregateType" VARCHAR(64) NOT NULL,
    "aggregateId" UUID NOT NULL,
    "deduplicationKey" VARCHAR(255) NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "NotificationOutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claimedAt" TIMESTAMPTZ(3),
    "processedAt" TIMESTAMPTZ(3),
    "lastError" VARCHAR(1000),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "notification_outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "notification_outbox_events_deduplicationKey_key" ON "notification_outbox_events"("deduplicationKey");

-- CreateIndex
CREATE INDEX "notification_outbox_events_status_nextAttemptAt_idx" ON "notification_outbox_events"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "notification_outbox_events_aggregateType_aggregateId_create_idx" ON "notification_outbox_events"("aggregateType", "aggregateId", "createdAt");

-- CreateIndex
CREATE INDEX "notification_outbox_events_claimedAt_idx" ON "notification_outbox_events"("claimedAt");
