ALTER TABLE "site_settings"
  ADD COLUMN "cartRecoveryRemindersEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "cartRecoveryIdleHours" INTEGER NOT NULL DEFAULT 24,
  ADD COLUMN "cartRecoveryRetentionDays" INTEGER NOT NULL DEFAULT 14,
  ADD CONSTRAINT "site_settings_cart_recovery_window_check" CHECK (
    "cartRecoveryIdleHours" BETWEEN 1 AND 168
    AND "cartRecoveryRetentionDays" BETWEEN 1 AND 30
    AND "cartRecoveryIdleHours" < "cartRecoveryRetentionDays" * 24
  );

CREATE TABLE "saved_carts" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "activeUserId" UUID,
  "orderId" UUID,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "items" JSONB NOT NULL,
  "fingerprint" CHAR(64) NOT NULL,
  "savedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "eligibleAt" TIMESTAMPTZ(3) NOT NULL,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  "abandonedAt" TIMESTAMPTZ(3),
  "restoredAt" TIMESTAMPTZ(3),
  "hiddenAt" TIMESTAMPTZ(3),
  "closedAt" TIMESTAMPTZ(3),
  CONSTRAINT "saved_carts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "saved_carts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "saved_carts_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "saved_carts_state_check" CHECK (
    jsonb_typeof("items") = 'array' AND "revision" > 0
    AND "savedAt" < "eligibleAt" AND "eligibleAt" < "expiresAt" AND (
      ("activeUserId" IS NOT NULL AND "activeUserId" = "userId" AND "closedAt" IS NULL AND "orderId" IS NULL)
      OR ("activeUserId" IS NULL AND "closedAt" IS NOT NULL)
    )
  )
);
CREATE UNIQUE INDEX "saved_carts_activeUserId_key" ON "saved_carts"("activeUserId");
CREATE UNIQUE INDEX "saved_carts_orderId_key" ON "saved_carts"("orderId");
CREATE INDEX "saved_carts_savedAt_idx" ON "saved_carts"("savedAt");
CREATE INDEX "saved_carts_activeUserId_expiresAt_idx" ON "saved_carts"("activeUserId", "expiresAt");
CREATE INDEX "saved_carts_expiresAt_idx" ON "saved_carts"("expiresAt");
CREATE INDEX "saved_carts_abandonedAt_idx" ON "saved_carts"("abandonedAt");
CREATE INDEX "saved_carts_userId_idx" ON "saved_carts"("userId");
