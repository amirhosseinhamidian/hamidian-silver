-- Stage 060: harden shipping provider boundaries and shipment timeline integrity.
-- Application code now guarantees DELIVERED shipments have both shippedAt and deliveredAt.

ALTER TABLE "shipments"
  DROP CONSTRAINT "shipments_status_timestamps_valid";

ALTER TABLE "shipments"
  ADD CONSTRAINT "shipments_status_timestamps_valid"
  CHECK (
    (
      "status" NOT IN ('HANDED_OVER', 'IN_TRANSIT', 'DELIVERED')
      OR "shippedAt" IS NOT NULL
    )
    AND ("status" <> 'DELIVERED' OR "deliveredAt" IS NOT NULL)
    AND (
      "shippedAt" IS NULL
      OR "deliveredAt" IS NULL
      OR "deliveredAt" >= "shippedAt"
    )
  );
