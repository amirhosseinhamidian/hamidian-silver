CREATE TYPE "WalletSource" AS ENUM ('PURCHASE', 'REFERRAL');
CREATE TYPE "WalletBucket" AS ENUM ('PENDING', 'AVAILABLE', 'RESERVED', 'CAPTURED', 'EXPIRED', 'REVOKED');
CREATE TYPE "WalletOperationKind" AS ENUM ('GRANT', 'ACTIVATE', 'RESERVE', 'RELEASE', 'CAPTURE', 'EXPIRE', 'REVOKE_GRANT', 'REVERSE_CAPTURE');
CREATE TYPE "WalletReservationStatus" AS ENUM ('RESERVED', 'CAPTURED', 'RELEASED');

CREATE TABLE "wallet_lots" (
  "id" UUID PRIMARY KEY,
  "userId" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "orderId" UUID NOT NULL REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "policyVersion" INTEGER NOT NULL REFERENCES "reward_policy_versions"("version") ON DELETE RESTRICT ON UPDATE CASCADE,
  "source" "WalletSource" NOT NULL,
  "sourceKey" VARCHAR(128) NOT NULL,
  "grantedToman" INTEGER NOT NULL,
  "pendingToman" INTEGER NOT NULL,
  "availableToman" INTEGER NOT NULL DEFAULT 0,
  "reservedToman" INTEGER NOT NULL DEFAULT 0,
  "capturedToman" INTEGER NOT NULL DEFAULT 0,
  "expiredToman" INTEGER NOT NULL DEFAULT 0,
  "revokedToman" INTEGER NOT NULL DEFAULT 0,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  "activatedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "wallet_lots_amounts_valid" CHECK (
    "grantedToman" > 0 AND "pendingToman" >= 0 AND "availableToman" >= 0 AND "reservedToman" >= 0
    AND "capturedToman" >= 0 AND "expiredToman" >= 0 AND "revokedToman" >= 0
    AND "grantedToman" = "pendingToman"::bigint + "availableToman" + "reservedToman"
      + "capturedToman" + "expiredToman" + "revokedToman"
  ),
  CONSTRAINT "wallet_lots_dates_valid" CHECK (
    "expiresAt" > "createdAt"
    AND ("activatedAt" IS NULL OR "activatedAt" >= "createdAt" AND "activatedAt" < "expiresAt")
  )
);

CREATE TABLE "wallet_reservations" (
  "id" UUID PRIMARY KEY,
  "userId" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "orderId" UUID NOT NULL REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "amountToman" INTEGER NOT NULL CHECK ("amountToman" > 0),
  "status" "WalletReservationStatus" NOT NULL DEFAULT 'RESERVED',
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMPTZ(3),
  CONSTRAINT "wallet_reservations_status_valid" CHECK (
    ("status" = 'RESERVED') = ("resolvedAt" IS NULL)
  )
);

CREATE TABLE "wallet_operations" (
  "id" UUID PRIMARY KEY,
  "sequence" BIGSERIAL NOT NULL,
  "userId" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "idempotencyKey" VARCHAR(128) NOT NULL,
  "fingerprint" CHAR(64) NOT NULL,
  "kind" "WalletOperationKind" NOT NULL,
  "actorUserId" UUID REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "reason" VARCHAR(250),
  "recordedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "wallet_operations_reason_valid" CHECK (
    ("actorUserId" IS NULL AND "reason" IS NULL)
    OR ("actorUserId" IS NOT NULL AND "reason" IS NOT NULL AND length(trim("reason")) >= 3)
  )
);

CREATE TABLE "wallet_ledger_entries" (
  "id" UUID PRIMARY KEY,
  "operationId" UUID NOT NULL REFERENCES "wallet_operations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "lotId" UUID NOT NULL REFERENCES "wallet_lots"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "reservationId" UUID REFERENCES "wallet_reservations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "amountToman" INTEGER NOT NULL CHECK ("amountToman" > 0),
  "fromBucket" "WalletBucket",
  "toBucket" "WalletBucket" NOT NULL,
  CONSTRAINT "wallet_ledger_entries_movement_valid" CHECK (
    ("fromBucket" IS NULL AND "toBucket" = 'PENDING' AND "reservationId" IS NULL)
    OR ("fromBucket" IS NOT NULL AND (
      ("fromBucket" = 'PENDING' AND "toBucket" IN ('AVAILABLE', 'EXPIRED', 'REVOKED'))
      OR ("fromBucket" = 'AVAILABLE' AND "toBucket" IN ('RESERVED', 'EXPIRED', 'REVOKED'))
      OR ("fromBucket" = 'RESERVED' AND "toBucket" IN ('AVAILABLE', 'CAPTURED', 'EXPIRED'))
      OR ("fromBucket" = 'CAPTURED' AND "toBucket" IN ('AVAILABLE', 'EXPIRED'))
    ) AND (
      ("fromBucket" IN ('RESERVED', 'CAPTURED') OR "toBucket" = 'RESERVED') = ("reservationId" IS NOT NULL)
    ))
  )
);

CREATE UNIQUE INDEX "wallet_lots_source_sourceKey_key" ON "wallet_lots"("source", "sourceKey");
CREATE UNIQUE INDEX "wallet_lots_one_purchase_reward_per_order"
  ON "wallet_lots"("orderId") WHERE "source" = 'PURCHASE';
CREATE INDEX "wallet_lots_userId_expiresAt_id_idx" ON "wallet_lots"("userId", "expiresAt", "id");
CREATE INDEX "wallet_lots_orderId_idx" ON "wallet_lots"("orderId");
CREATE INDEX "wallet_reservations_userId_status_idx" ON "wallet_reservations"("userId", "status");
CREATE INDEX "wallet_reservations_orderId_idx" ON "wallet_reservations"("orderId");
CREATE UNIQUE INDEX "wallet_reservations_one_live_per_order"
  ON "wallet_reservations"("orderId") WHERE "status" IN ('RESERVED', 'CAPTURED');
CREATE UNIQUE INDEX "wallet_operations_userId_idempotencyKey_key" ON "wallet_operations"("userId", "idempotencyKey");
CREATE UNIQUE INDEX "wallet_operations_sequence_key" ON "wallet_operations"("sequence");
CREATE INDEX "wallet_operations_userId_sequence_idx" ON "wallet_operations"("userId", "sequence");
CREATE INDEX "wallet_ledger_entries_operationId_idx" ON "wallet_ledger_entries"("operationId");
CREATE INDEX "wallet_ledger_entries_lotId_idx" ON "wallet_ledger_entries"("lotId");
CREATE INDEX "wallet_ledger_entries_reservationId_fromBucket_idx" ON "wallet_ledger_entries"("reservationId", "fromBucket");

CREATE FUNCTION "validate_wallet_ledger_owner"() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  owner_id UUID;
BEGIN
  SELECT "userId" INTO owner_id FROM "wallet_operations" WHERE "id" = NEW."operationId";
  IF NOT EXISTS (
    SELECT 1 FROM "wallet_lots" WHERE "id" = NEW."lotId" AND "userId" = owner_id
  ) OR (NEW."reservationId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "wallet_reservations" WHERE "id" = NEW."reservationId" AND "userId" = owner_id
  )) THEN
    RAISE EXCEPTION 'Wallet movement references a different wallet' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "wallet_ledger_entries_owner_check"
  BEFORE INSERT ON "wallet_ledger_entries"
  FOR EACH ROW EXECUTE FUNCTION "validate_wallet_ledger_owner"();

CREATE FUNCTION "prevent_wallet_ledger_mutation"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Wallet journal rows are append-only' USING ERRCODE = '23000';
END;
$$;

CREATE TRIGGER "wallet_operations_append_only"
  BEFORE UPDATE OR DELETE ON "wallet_operations"
  FOR EACH ROW EXECUTE FUNCTION "prevent_wallet_ledger_mutation"();
CREATE TRIGGER "wallet_ledger_entries_append_only"
  BEFORE UPDATE OR DELETE ON "wallet_ledger_entries"
  FOR EACH ROW EXECUTE FUNCTION "prevent_wallet_ledger_mutation"();

CREATE TRIGGER "wallet_operations_no_truncate"
  BEFORE TRUNCATE ON "wallet_operations"
  FOR EACH STATEMENT EXECUTE FUNCTION "prevent_wallet_ledger_mutation"();

CREATE TRIGGER "wallet_ledger_entries_no_truncate"
  BEFORE TRUNCATE ON "wallet_ledger_entries"
  FOR EACH STATEMENT EXECUTE FUNCTION "prevent_wallet_ledger_mutation"();
