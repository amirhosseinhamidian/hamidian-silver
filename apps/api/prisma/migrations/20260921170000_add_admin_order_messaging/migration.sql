CREATE TYPE "AdminMessageChannel" AS ENUM ('TELEGRAM', 'BALE');

CREATE TABLE "admin_message_recipients" (
    "userId" UUID NOT NULL,
    "telegramChatId" VARCHAR(32),
    "baleChatId" VARCHAR(32),
    "updatedByUserId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "admin_message_recipients_pkey" PRIMARY KEY ("userId")
);

CREATE TABLE "admin_order_notification_deliveries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "orderId" UUID NOT NULL,
    "recipientUserId" UUID NOT NULL,
    "channel" "AdminMessageChannel" NOT NULL,
    "chatIdSnapshot" VARCHAR(32) NOT NULL,
    "status" "NotificationOutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claimedAt" TIMESTAMPTZ(3),
    "processedAt" TIMESTAMPTZ(3),
    "lastError" VARCHAR(1000),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "admin_order_notification_deliveries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "admin_message_recipients_telegramChatId_key"
ON "admin_message_recipients"("telegramChatId");

CREATE UNIQUE INDEX "admin_message_recipients_baleChatId_key"
ON "admin_message_recipients"("baleChatId");

CREATE INDEX "admin_message_recipients_updatedByUserId_idx"
ON "admin_message_recipients"("updatedByUserId");

CREATE UNIQUE INDEX "admin_order_notification_deliveries_orderId_recipientUserId_channel_key"
ON "admin_order_notification_deliveries"("orderId", "recipientUserId", "channel");

CREATE INDEX "admin_order_notification_deliveries_status_nextAttemptAt_idx"
ON "admin_order_notification_deliveries"("status", "nextAttemptAt");

CREATE INDEX "admin_order_notification_deliveries_recipientUserId_createdAt_idx"
ON "admin_order_notification_deliveries"("recipientUserId", "createdAt");

CREATE INDEX "admin_order_notification_deliveries_claimedAt_idx"
ON "admin_order_notification_deliveries"("claimedAt");

ALTER TABLE "admin_message_recipients"
ADD CONSTRAINT "admin_message_recipients_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "admin_message_recipients"
ADD CONSTRAINT "admin_message_recipients_updatedByUserId_fkey"
FOREIGN KEY ("updatedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "admin_order_notification_deliveries"
ADD CONSTRAINT "admin_order_notification_deliveries_orderId_fkey"
FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "admin_order_notification_deliveries"
ADD CONSTRAINT "admin_order_notification_deliveries_recipientUserId_fkey"
FOREIGN KEY ("recipientUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
