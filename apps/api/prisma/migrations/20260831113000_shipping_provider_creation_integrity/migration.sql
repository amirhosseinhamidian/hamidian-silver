-- Stage 061: harden provider-shipment finalization and external identifier integrity.
-- Prisma does not model this partial unique index in schema.prisma.

CREATE UNIQUE INDEX "shipments_provider_external_id_unique_idx"
ON "shipments" ("provider", "providerShipmentId")
WHERE "providerShipmentId" IS NOT NULL;
