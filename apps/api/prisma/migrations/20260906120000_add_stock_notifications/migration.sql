ALTER TYPE "NotificationOutboxEventType" ADD VALUE IF NOT EXISTS 'STOCK_AVAILABLE';

CREATE TYPE "StockNotificationStatus" AS ENUM ('ACTIVE', 'QUEUED', 'NOTIFIED', 'CANCELLED');

CREATE TABLE "stock_notification_subscriptions" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "productId" UUID NOT NULL,
  "variantId" UUID,
  "status" "StockNotificationStatus" NOT NULL DEFAULT 'ACTIVE',
  "queuedAt" TIMESTAMPTZ(3),
  "notifiedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,

  CONSTRAINT "stock_notification_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "stock_notification_subscriptions_userId_status_idx"
  ON "stock_notification_subscriptions"("userId", "status");
CREATE INDEX "stock_notification_subscriptions_productId_status_idx"
  ON "stock_notification_subscriptions"("productId", "status");
CREATE INDEX "stock_notification_subscriptions_variantId_status_idx"
  ON "stock_notification_subscriptions"("variantId", "status");

CREATE UNIQUE INDEX "stock_notification_subscriptions_active_product_key"
  ON "stock_notification_subscriptions"("userId", "productId")
  WHERE "variantId" IS NULL AND "status" IN ('ACTIVE', 'QUEUED');
CREATE UNIQUE INDEX "stock_notification_subscriptions_active_variant_key"
  ON "stock_notification_subscriptions"("userId", "variantId")
  WHERE "variantId" IS NOT NULL AND "status" IN ('ACTIVE', 'QUEUED');

ALTER TABLE "stock_notification_subscriptions"
  ADD CONSTRAINT "stock_notification_subscriptions_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "stock_notification_subscriptions_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "stock_notification_subscriptions_variantId_fkey"
  FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION "queue_stock_available_notifications"()
RETURNS TRIGGER AS $$
BEGIN
  IF
    (TG_OP = 'INSERT' AND NEW."onHand" - NEW."reserved" > 0)
    OR
    (
      TG_OP = 'UPDATE'
      AND OLD."onHand" - OLD."reserved" <= 0
      AND NEW."onHand" - NEW."reserved" > 0
    )
  THEN
    WITH queued AS (
      UPDATE "stock_notification_subscriptions" AS subscription
      SET
        "status" = 'QUEUED',
        "queuedAt" = CURRENT_TIMESTAMP,
        "updatedAt" = CURRENT_TIMESTAMP
      FROM "product_variants" AS variant
      WHERE
        variant."id" = NEW."variantId"
        AND subscription."status" = 'ACTIVE'
        AND (
          subscription."variantId" = NEW."variantId"
          OR (
            subscription."variantId" IS NULL
            AND subscription."productId" = variant."productId"
          )
        )
      RETURNING subscription."id"
    )
    INSERT INTO "notification_outbox_events" (
      "id",
      "type",
      "aggregateType",
      "aggregateId",
      "deduplicationKey",
      "payload",
      "status",
      "attempts",
      "nextAttemptAt",
      "createdAt",
      "updatedAt"
    )
    SELECT
      gen_random_uuid(),
      'STOCK_AVAILABLE'::"NotificationOutboxEventType",
      'STOCK_SUBSCRIPTION',
      queued."id",
      'stock-available:' || queued."id"::text,
      '{}'::jsonb,
      'PENDING'::"NotificationOutboxStatus",
      0,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    FROM queued
    ON CONFLICT ("deduplicationKey") DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "inventory_queue_stock_available_notifications"
AFTER INSERT OR UPDATE OF "onHand", "reserved" ON "inventory"
FOR EACH ROW
EXECUTE FUNCTION "queue_stock_available_notifications"();
