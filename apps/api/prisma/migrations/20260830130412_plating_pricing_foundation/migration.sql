-- CreateEnum
CREATE TYPE "PlatingType" AS ENUM ('GOLD', 'RHODIUM');

-- AlterTable
ALTER TABLE "product_variants" ADD COLUMN     "platingEligible" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "plating_rates" (
    "id" UUID NOT NULL,
    "type" "PlatingType" NOT NULL,
    "pricePerGramToman" INTEGER NOT NULL,
    "leadTimeDays" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "plating_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plating_rate_history" (
    "id" UUID NOT NULL,
    "platingRateId" UUID NOT NULL,
    "changedByUserId" UUID,
    "previousPricePerGramToman" INTEGER,
    "newPricePerGramToman" INTEGER NOT NULL,
    "previousLeadTimeDays" INTEGER,
    "newLeadTimeDays" INTEGER NOT NULL,
    "reason" VARCHAR(500),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plating_rate_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_plating_options" (
    "variantId" UUID NOT NULL,
    "platingRateId" UUID NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "product_plating_options_pkey" PRIMARY KEY ("variantId","platingRateId")
);

-- CreateIndex
CREATE UNIQUE INDEX "plating_rates_type_key" ON "plating_rates"("type");

-- CreateIndex
CREATE INDEX "plating_rates_isActive_idx" ON "plating_rates"("isActive");

-- CreateIndex
CREATE INDEX "plating_rate_history_platingRateId_createdAt_idx" ON "plating_rate_history"("platingRateId", "createdAt");

-- CreateIndex
CREATE INDEX "plating_rate_history_changedByUserId_idx" ON "plating_rate_history"("changedByUserId");

-- CreateIndex
CREATE INDEX "product_plating_options_platingRateId_isActive_idx" ON "product_plating_options"("platingRateId", "isActive");

-- AddForeignKey
ALTER TABLE "plating_rate_history" ADD CONSTRAINT "plating_rate_history_platingRateId_fkey" FOREIGN KEY ("platingRateId") REFERENCES "plating_rates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plating_rate_history" ADD CONSTRAINT "plating_rate_history_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_plating_options" ADD CONSTRAINT "product_plating_options_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_plating_options" ADD CONSTRAINT "product_plating_options_platingRateId_fkey" FOREIGN KEY ("platingRateId") REFERENCES "plating_rates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
