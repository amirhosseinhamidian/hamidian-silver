CREATE TYPE "ProductPurchaseMode" AS ENUM ('SIMPLE', 'COMPOSITE');
CREATE TYPE "VariantInventoryMode" AS ENUM ('OWN', 'COMPONENTS');

ALTER TABLE "products"
ADD COLUMN "purchaseMode" "ProductPurchaseMode" NOT NULL DEFAULT 'SIMPLE';

ALTER TABLE "product_variants"
ADD COLUMN "inventoryMode" "VariantInventoryMode" NOT NULL DEFAULT 'OWN';

CREATE TABLE "product_variant_components" (
    "bundleVariantId" UUID NOT NULL,
    "componentVariantId" UUID NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "product_variant_components_pkey" PRIMARY KEY ("bundleVariantId", "componentVariantId"),
    CONSTRAINT "product_variant_components_positive_quantity_check" CHECK ("quantity" > 0),
    CONSTRAINT "product_variant_components_distinct_variants_check" CHECK ("bundleVariantId" <> "componentVariantId")
);

CREATE INDEX "product_variant_components_componentVariantId_idx"
ON "product_variant_components"("componentVariantId");

ALTER TABLE "product_variant_components"
ADD CONSTRAINT "product_variant_components_bundleVariantId_fkey"
FOREIGN KEY ("bundleVariantId") REFERENCES "product_variants"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "product_variant_components"
ADD CONSTRAINT "product_variant_components_componentVariantId_fkey"
FOREIGN KEY ("componentVariantId") REFERENCES "product_variants"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION "queue_stock_available_notifications"()
RETURNS TRIGGER AS $$
BEGIN
  IF
    (TG_OP = 'INSERT' AND NEW."onHand" - NEW."reserved" > 0)
    OR
    (
      TG_OP = 'UPDATE'
      AND NEW."onHand" - NEW."reserved" > 0
      AND NEW."onHand" - NEW."reserved" > OLD."onHand" - OLD."reserved"
    )
  THEN
    WITH queued AS (
      UPDATE "stock_notification_subscriptions" AS subscription
      SET "status" = 'QUEUED', "queuedAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP
      FROM "product_variants" AS changed_variant
      WHERE
        changed_variant."id" = NEW."variantId"
        AND subscription."status" = 'ACTIVE'
        AND (
          subscription."variantId" = NEW."variantId"
          OR (subscription."variantId" IS NULL AND subscription."productId" = changed_variant."productId")
          OR EXISTS (
            SELECT 1
            FROM "product_variant_components" AS changed_component
            JOIN "product_variants" AS bundle ON bundle."id" = changed_component."bundleVariantId"
            WHERE
              changed_component."componentVariantId" = NEW."variantId"
              AND subscription."variantId" = bundle."id"
              AND bundle."inventoryMode" = 'COMPONENTS'
              AND bundle."isActive" = true
              AND bundle."deletedAt" IS NULL
              AND NOT EXISTS (
                SELECT 1
                FROM "product_variant_components" AS required_component
                JOIN "product_variants" AS component_variant
                  ON component_variant."id" = required_component."componentVariantId"
                WHERE
                  required_component."bundleVariantId" = bundle."id"
                  AND (
                    component_variant."inventoryMode" <> 'OWN'
                    OR component_variant."isActive" = false
                    OR component_variant."deletedAt" IS NOT NULL
                    OR COALESCE((
                      SELECT SUM(GREATEST(inventory."onHand" - inventory."reserved", 0))
                      FROM "inventory" AS inventory
                      JOIN "warehouses" AS warehouse ON warehouse."id" = inventory."warehouseId"
                      WHERE inventory."variantId" = component_variant."id"
                        AND warehouse."isActive" = true
                        AND warehouse."deletedAt" IS NULL
                    ), 0) < required_component."quantity"
                  )
              )
          )
        )
      RETURNING subscription."id"
    )
    INSERT INTO "notification_outbox_events" (
      "id", "type", "aggregateType", "aggregateId", "deduplicationKey", "payload",
      "status", "attempts", "nextAttemptAt", "createdAt", "updatedAt"
    )
    SELECT gen_random_uuid(), 'STOCK_AVAILABLE'::"NotificationOutboxEventType",
      'STOCK_SUBSCRIPTION', queued."id", 'stock-available:' || queued."id"::text,
      '{}'::jsonb, 'PENDING'::"NotificationOutboxStatus", 0,
      CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    FROM queued
    ON CONFLICT ("deduplicationKey") DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
