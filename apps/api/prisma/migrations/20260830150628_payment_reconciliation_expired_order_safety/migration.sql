-- CreateEnum
CREATE TYPE "PaymentReconciliationStatus" AS ENUM ('OPEN', 'RESOLVED');

-- CreateEnum
CREATE TYPE "PaymentReconciliationResolution" AS ENUM ('REFUNDED_EXTERNALLY');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PaymentAttemptStatus" ADD VALUE 'RECONCILIATION_REQUIRED';
ALTER TYPE "PaymentAttemptStatus" ADD VALUE 'RECONCILED';

-- AlterEnum
ALTER TYPE "PaymentStatus" ADD VALUE 'RECONCILIATION_REQUIRED';

-- CreateTable
CREATE TABLE "payment_reconciliations" (
    "id" UUID NOT NULL,
    "paymentAttemptId" UUID NOT NULL,
    "provider" VARCHAR(64) NOT NULL,
    "providerReference" VARCHAR(255) NOT NULL,
    "amountToman" INTEGER NOT NULL,
    "detectedOrderStatus" "OrderStatus" NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "status" "PaymentReconciliationStatus" NOT NULL DEFAULT 'OPEN',
    "resolution" "PaymentReconciliationResolution",
    "resolutionNote" VARCHAR(1000),
    "resolvedByUserId" UUID,
    "resolvedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "payment_reconciliations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payment_reconciliations_paymentAttemptId_key" ON "payment_reconciliations"("paymentAttemptId");

-- CreateIndex
CREATE INDEX "payment_reconciliations_status_createdAt_idx" ON "payment_reconciliations"("status", "createdAt");

-- CreateIndex
CREATE INDEX "payment_reconciliations_provider_createdAt_idx" ON "payment_reconciliations"("provider", "createdAt");

-- CreateIndex
CREATE INDEX "payment_reconciliations_resolvedByUserId_idx" ON "payment_reconciliations"("resolvedByUserId");

-- AddForeignKey
ALTER TABLE "payment_reconciliations" ADD CONSTRAINT "payment_reconciliations_paymentAttemptId_fkey" FOREIGN KEY ("paymentAttemptId") REFERENCES "payment_attempts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_reconciliations" ADD CONSTRAINT "payment_reconciliations_resolvedByUserId_fkey" FOREIGN KEY ("resolvedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
