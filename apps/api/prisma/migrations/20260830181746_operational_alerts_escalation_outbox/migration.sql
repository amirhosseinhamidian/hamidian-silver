-- CreateEnum
CREATE TYPE "OperationalAlertLevel" AS ENUM ('INITIAL', 'ESCALATION');

-- CreateTable
CREATE TABLE "operational_alert_outbox_events" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "recipientUserId" UUID,
    "recipientPhone" VARCHAR(20) NOT NULL,
    "code" VARCHAR(80) NOT NULL,
    "level" "OperationalAlertLevel" NOT NULL,
    "priority" VARCHAR(16) NOT NULL,
    "incidentFingerprint" VARCHAR(180) NOT NULL,
    "deduplicationKey" VARCHAR(255) NOT NULL,
    "dueAt" TIMESTAMPTZ(3),
    "payload" JSONB NOT NULL,
    "status" "NotificationOutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claimedAt" TIMESTAMPTZ(3),
    "processedAt" TIMESTAMPTZ(3),
    "lastError" VARCHAR(1000),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "operational_alert_outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "operational_alert_outbox_events_deduplicationKey_key" ON "operational_alert_outbox_events"("deduplicationKey");

-- CreateIndex
CREATE INDEX "operational_alert_outbox_events_status_nextAttemptAt_idx" ON "operational_alert_outbox_events"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "operational_alert_outbox_events_orderId_code_createdAt_idx" ON "operational_alert_outbox_events"("orderId", "code", "createdAt");

-- CreateIndex
CREATE INDEX "operational_alert_outbox_events_recipientUserId_createdAt_idx" ON "operational_alert_outbox_events"("recipientUserId", "createdAt");

-- CreateIndex
CREATE INDEX "operational_alert_outbox_events_incidentFingerprint_idx" ON "operational_alert_outbox_events"("incidentFingerprint");

-- CreateIndex
CREATE INDEX "operational_alert_outbox_events_claimedAt_idx" ON "operational_alert_outbox_events"("claimedAt");

-- AddForeignKey
ALTER TABLE "operational_alert_outbox_events" ADD CONSTRAINT "operational_alert_outbox_events_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operational_alert_outbox_events" ADD CONSTRAINT "operational_alert_outbox_events_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
