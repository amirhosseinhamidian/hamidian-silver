-- CreateEnum
CREATE TYPE "SupplierCreditApplicationStatus" AS ENUM ('ACTIVE', 'REMOVED');

-- AlterEnum
ALTER TYPE "SupplierCreditStatus" ADD VALUE 'PARTIALLY_APPLIED';

-- AlterTable
ALTER TABLE "supplier_credits" ADD COLUMN     "appliedAmountToman" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "supplier_settlements" ADD COLUMN     "creditAppliedToman" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "paidAmountToman" INTEGER;

-- CreateTable
CREATE TABLE "supplier_credit_applications" (
    "id" UUID NOT NULL,
    "settlementId" UUID NOT NULL,
    "supplierCreditId" UUID NOT NULL,
    "idempotencyKey" VARCHAR(120) NOT NULL,
    "amountToman" INTEGER NOT NULL,
    "status" "SupplierCreditApplicationStatus" NOT NULL DEFAULT 'ACTIVE',
    "appliedByUserId" UUID,
    "removedByUserId" UUID,
    "removalReason" VARCHAR(1000),
    "removedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "supplier_credit_applications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "supplier_credit_applications_idempotencyKey_key" ON "supplier_credit_applications"("idempotencyKey");

-- CreateIndex
CREATE INDEX "supplier_credit_applications_settlementId_status_createdAt_idx" ON "supplier_credit_applications"("settlementId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "supplier_credit_applications_supplierCreditId_status_create_idx" ON "supplier_credit_applications"("supplierCreditId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "supplier_credit_applications_appliedByUserId_idx" ON "supplier_credit_applications"("appliedByUserId");

-- CreateIndex
CREATE INDEX "supplier_credit_applications_removedByUserId_idx" ON "supplier_credit_applications"("removedByUserId");

-- AddForeignKey
ALTER TABLE "supplier_credit_applications" ADD CONSTRAINT "supplier_credit_applications_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "supplier_settlements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_credit_applications" ADD CONSTRAINT "supplier_credit_applications_supplierCreditId_fkey" FOREIGN KEY ("supplierCreditId") REFERENCES "supplier_credits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_credit_applications" ADD CONSTRAINT "supplier_credit_applications_appliedByUserId_fkey" FOREIGN KEY ("appliedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_credit_applications" ADD CONSTRAINT "supplier_credit_applications_removedByUserId_fkey" FOREIGN KEY ("removedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
