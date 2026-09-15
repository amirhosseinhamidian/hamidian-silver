BEGIN;

ALTER TABLE "audit_logs"
  ADD COLUMN IF NOT EXISTS "title" VARCHAR(500),
  ADD COLUMN IF NOT EXISTS "operationType" VARCHAR(80),
  ADD COLUMN IF NOT EXISTS "entityName" VARCHAR(200),
  ADD COLUMN IF NOT EXISTS "changes" JSONB;

-- Existing audit rows need a one-time backfill. Temporarily disable only the
-- audit table's append-only trigger; the surrounding transaction guarantees
-- that the trigger is restored if any later statement fails.
ALTER TABLE "audit_logs" DISABLE TRIGGER "audit_logs_append_only";

UPDATE "audit_logs"
SET "operationType" = CASE
  WHEN "action" LIKE '%/sale-price%' THEN 'PRICE_CHANGE'
  WHEN "action" LIKE '%/status%' THEN 'STATUS_CHANGE'
  WHEN "action" LIKE '%/stock/%' THEN 'STOCK_ADJUSTMENT'
  WHEN "action" LIKE '%/permissions%' THEN 'PERMISSION_CHANGE'
  WHEN "method" = 'POST' THEN 'CREATE'
  WHEN "method" = 'DELETE' THEN 'DELETE'
  ELSE 'UPDATE'
END
WHERE "operationType" IS NULL;

ALTER TABLE "audit_logs" ENABLE TRIGGER "audit_logs_append_only";

CREATE INDEX IF NOT EXISTS "audit_logs_operationType_createdAt_idx"
  ON "audit_logs"("operationType", "createdAt");

COMMIT;
