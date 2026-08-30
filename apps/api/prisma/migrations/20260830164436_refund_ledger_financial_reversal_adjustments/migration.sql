-- CreateEnum
CREATE TYPE "PaymentRefundStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'FAILED');

-- AlterEnum
ALTER TYPE "PaymentStatus" ADD VALUE 'PARTIALLY_REFUNDED';

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "refundAllocatedToman" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "refundedAmountToman" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "payment_refunds" (
    "id" UUID NOT NULL,
    "paymentId" UUID NOT NULL,
    "idempotencyKey" VARCHAR(120) NOT NULL,
    "status" "PaymentRefundStatus" NOT NULL DEFAULT 'PENDING',
    "amountToman" INTEGER NOT NULL,
    "providerSnapshot" VARCHAR(64),
    "originalProviderReferenceSnapshot" VARCHAR(255),
    "externalReference" VARCHAR(255),
    "requestNote" VARCHAR(1000),
    "resolutionNote" VARCHAR(1000),
    "requestedByUserId" UUID,
    "confirmedByUserId" UUID,
    "cancelledByUserId" UUID,
    "confirmedAt" TIMESTAMPTZ(3),
    "cancelledAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "payment_refunds_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payment_refunds_idempotencyKey_key" ON "payment_refunds"("idempotencyKey");

-- CreateIndex
CREATE INDEX "payment_refunds_paymentId_createdAt_idx" ON "payment_refunds"("paymentId", "createdAt");

-- CreateIndex
CREATE INDEX "payment_refunds_status_createdAt_idx" ON "payment_refunds"("status", "createdAt");

-- CreateIndex
CREATE INDEX "payment_refunds_confirmedAt_idx" ON "payment_refunds"("confirmedAt");

-- CreateIndex
CREATE INDEX "payment_refunds_requestedByUserId_idx" ON "payment_refunds"("requestedByUserId");

-- CreateIndex
CREATE INDEX "payment_refunds_confirmedByUserId_idx" ON "payment_refunds"("confirmedByUserId");

-- CreateIndex
CREATE INDEX "payment_refunds_cancelledByUserId_idx" ON "payment_refunds"("cancelledByUserId");

-- AddForeignKey
ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_confirmedByUserId_fkey" FOREIGN KEY ("confirmedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_cancelledByUserId_fkey" FOREIGN KEY ("cancelledByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
