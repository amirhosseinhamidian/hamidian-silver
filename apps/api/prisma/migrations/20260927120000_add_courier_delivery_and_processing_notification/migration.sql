ALTER TABLE "shipping_carriers"
ADD COLUMN "deliveryType" VARCHAR(16) NOT NULL DEFAULT 'POST';

ALTER TABLE "orders"
ADD COLUMN "shippingDeliveryTypeSnapshot" VARCHAR(16) NOT NULL DEFAULT 'POST';

ALTER TABLE "shipments"
ADD COLUMN "deliveryTypeSnapshot" VARCHAR(16) NOT NULL DEFAULT 'POST';

UPDATE "shipping_carriers"
SET "deliveryType" = 'COURIER'
WHERE "pricingMode" = 'COLLECT';

UPDATE "orders"
SET "shippingDeliveryTypeSnapshot" = 'COURIER'
WHERE "shippingPricingModeSnapshot" = 'COLLECT';

UPDATE "shipments" AS shipment
SET "deliveryTypeSnapshot" = "order"."shippingDeliveryTypeSnapshot"
FROM "orders" AS "order"
WHERE shipment."orderId" = "order"."id";

ALTER TYPE "NotificationOutboxEventType" ADD VALUE 'ORDER_PROCESSING' BEFORE 'ORDER_SHIPPED';

ALTER TABLE "shipping_carriers"
ADD CONSTRAINT "shipping_carriers_deliveryType_check"
CHECK ("deliveryType" IN ('POST', 'COURIER'));

ALTER TABLE "orders"
ADD CONSTRAINT "orders_shippingDeliveryTypeSnapshot_check"
CHECK ("shippingDeliveryTypeSnapshot" IN ('POST', 'COURIER'));

ALTER TABLE "shipments"
ADD CONSTRAINT "shipments_deliveryTypeSnapshot_check"
CHECK ("deliveryTypeSnapshot" IN ('POST', 'COURIER'));
