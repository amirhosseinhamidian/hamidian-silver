BEGIN;

ALTER TABLE "payment_attempts" ADD COLUMN "receiptRejectedAt" TIMESTAMPTZ(3);

-- Legacy rejected receipts have a terminal attempt and retain the rejection update time.
UPDATE "payment_attempts"
SET "receiptRejectedAt" = "updatedAt"
WHERE "provider" = 'card_to_card' AND "status" = 'FAILED'
  AND "failureCode" = 'CARD_TO_CARD_RECEIPT_REJECTED';

CREATE INDEX "orders_createdAt_idx" ON "orders"("createdAt");
CREATE INDEX "orders_paidAt_idx" ON "orders"("paidAt");
CREATE INDEX "orders_cancelledAt_idx" ON "orders"("cancelledAt");
CREATE INDEX "orders_deliveredAt_idx" ON "orders"("deliveredAt");
CREATE INDEX "order_status_history_toStatus_createdAt_idx" ON "order_status_history"("toStatus", "createdAt");
CREATE INDEX "order_returns_receivedAt_idx" ON "order_returns"("receivedAt");
CREATE INDEX "payment_attempts_receiptRejectedAt_idx" ON "payment_attempts"("receiptRejectedAt");
CREATE INDEX "payment_reconciliations_createdAt_idx" ON "payment_reconciliations"("createdAt");

COMMIT;
