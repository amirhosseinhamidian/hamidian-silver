CREATE TYPE "WalletReconciliationSubject" AS ENUM ('LOT', 'RESERVATION');
CREATE TYPE "WalletReconciliationCode" AS ENUM (
  'LEDGER_MISMATCH', 'RESERVATION_MISMATCH', 'SETTLEMENT_MISMATCH',
  'RECEIPT_PENDING', 'PAYMENT_UNCERTAIN', 'RESERVATION_OVERDUE'
);

CREATE TABLE "wallet_reconciliation_issues" (
  "subject" "WalletReconciliationSubject" NOT NULL,
  "subjectId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "orderId" UUID NOT NULL,
  "code" "WalletReconciliationCode" NOT NULL,
  "detectedAt" TIMESTAMPTZ(3) NOT NULL,
  "resolvedAt" TIMESTAMPTZ(3),
  PRIMARY KEY ("subject", "subjectId")
);

CREATE INDEX "wallet_reconciliation_issues_report_idx"
  ON "wallet_reconciliation_issues"("resolvedAt", "detectedAt", "subject", "subjectId");

CREATE INDEX "wallet_lots_expirable_idx" ON "wallet_lots"("expiresAt", "id")
  WHERE "pendingToman" > 0 OR "availableToman" > 0;
CREATE INDEX "wallet_reservations_open_idx" ON "wallet_reservations"("id")
  WHERE "status" = 'RESERVED';
