-- Stage 056: enforce inventory and fulfillment invariants at the PostgreSQL boundary.
-- Prisma does not currently model these CHECK constraints in schema.prisma.

-- At most one non-deleted warehouse can be the business default.
CREATE UNIQUE INDEX "warehouses_single_default_idx"
ON "warehouses" ("isDefault")
WHERE "isDefault" = true AND "deletedAt" IS NULL;

ALTER TABLE "inventory"
  ADD CONSTRAINT "inventory_balances_valid"
  CHECK (
    "onHand" >= 0
    AND "reserved" >= 0
    AND "reserved" <= "onHand"
    AND "lowStockThreshold" >= 0
  );

ALTER TABLE "inventory_movements"
  ADD CONSTRAINT "inventory_movements_balances_valid"
  CHECK (
    "onHandAfter" >= 0
    AND "reservedAfter" >= 0
    AND "reservedAfter" <= "onHandAfter"
  ),
  ADD CONSTRAINT "inventory_movements_reference_pair_valid"
  CHECK (
    ("referenceType" IS NULL AND "referenceId" IS NULL)
    OR
    ("referenceType" IS NOT NULL AND "referenceId" IS NOT NULL)
  );

ALTER TABLE "order_items"
  ADD CONSTRAINT "order_items_physical_values_valid"
  CHECK (
    ("unitWeightGrams" IS NULL OR "unitWeightGrams" >= 0)
    AND ("platingWeightGrams" IS NULL OR "platingWeightGrams" >= 0)
    AND (
      "platingLeadTimeDays" IS NULL
      OR ("platingLeadTimeDays" >= 0 AND "platingLeadTimeDays" <= 365)
    )
  );

ALTER TABLE "order_returns"
  ADD CONSTRAINT "order_returns_actor_timestamps_valid"
  CHECK (
    ("receivedByUserId" IS NULL OR "receivedAt" IS NOT NULL)
    AND ("cancelledByUserId" IS NULL OR "cancelledAt" IS NOT NULL)
  ),
  ADD CONSTRAINT "order_returns_lifecycle_valid"
  CHECK (
    (
      "status" = 'REQUESTED'
      AND "receivedAt" IS NULL
      AND "cancelledAt" IS NULL
    )
    OR
    (
      "status" = 'RECEIVED'
      AND "receivedAt" IS NOT NULL
      AND "cancelledAt" IS NULL
    )
    OR
    (
      "status" = 'CANCELLED'
      AND "cancelledAt" IS NOT NULL
      AND "receivedAt" IS NULL
    )
  );

ALTER TABLE "order_plating_fulfillments"
  ADD CONSTRAINT "order_plating_fulfillments_actor_timestamps_valid"
  CHECK (
    ("startedByUserId" IS NULL OR "startedAt" IS NOT NULL)
    AND ("completedByUserId" IS NULL OR "completedAt" IS NOT NULL)
    AND ("cancelledByUserId" IS NULL OR "cancelledAt" IS NOT NULL)
  ),
  ADD CONSTRAINT "order_plating_fulfillments_lifecycle_valid"
  CHECK (
    (
      "status" = 'PENDING'
      AND "startedAt" IS NULL
      AND "completedAt" IS NULL
      AND "cancelledAt" IS NULL
      AND "actualCostToman" IS NULL
    )
    OR
    (
      "status" = 'IN_PROGRESS'
      AND "startedAt" IS NOT NULL
      AND "completedAt" IS NULL
      AND "cancelledAt" IS NULL
      AND "actualCostToman" IS NULL
    )
    OR
    (
      "status" = 'COMPLETED'
      AND "startedAt" IS NOT NULL
      AND "completedAt" IS NOT NULL
      AND "cancelledAt" IS NULL
      AND "actualCostToman" IS NOT NULL
    )
    OR
    (
      "status" = 'CANCELLED'
      AND "completedAt" IS NULL
      AND "cancelledAt" IS NOT NULL
      AND "actualCostToman" IS NULL
    )
  );

ALTER TABLE "shipments"
  ADD CONSTRAINT "shipments_operational_values_valid"
  CHECK (
    "totalWeightGrams" >= 0
    AND ("estimatedDeliveryDays" IS NULL OR "estimatedDeliveryDays" >= 0)
  ),
  ADD CONSTRAINT "shipments_provider_creation_state_valid"
  CHECK (
    (
      "providerCreationState" = 'NOT_STARTED'
      AND "providerShipmentId" IS NULL
      AND "creationAttemptedAt" IS NULL
    )
    OR
    (
      "providerCreationState" = 'IN_PROGRESS'
      AND "providerShipmentId" IS NULL
      AND "creationAttemptedAt" IS NOT NULL
    )
    OR
    (
      "providerCreationState" = 'UNKNOWN'
      AND "providerShipmentId" IS NULL
      AND "creationAttemptedAt" IS NOT NULL
    )
    OR
    (
      "providerCreationState" = 'CREATED'
      AND "providerShipmentId" IS NOT NULL
    )
  ),
  ADD CONSTRAINT "shipments_status_timestamps_valid"
  CHECK (
    ("status" NOT IN ('HANDED_OVER', 'IN_TRANSIT') OR "shippedAt" IS NOT NULL)
    AND ("status" <> 'DELIVERED' OR "deliveredAt" IS NOT NULL)
    AND (
      "shippedAt" IS NULL
      OR "deliveredAt" IS NULL
      OR "deliveredAt" >= "shippedAt"
    )
  );
