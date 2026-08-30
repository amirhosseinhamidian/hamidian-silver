-- CreateTable
CREATE TABLE "payment_gateway_settings" (
    "provider" VARCHAR(64) NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "updatedByUserId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "payment_gateway_settings_pkey" PRIMARY KEY ("provider")
);

-- CreateIndex
CREATE INDEX "payment_gateway_settings_isEnabled_idx" ON "payment_gateway_settings"("isEnabled");

-- CreateIndex
CREATE INDEX "payment_gateway_settings_updatedByUserId_idx" ON "payment_gateway_settings"("updatedByUserId");

-- AddForeignKey
ALTER TABLE "payment_gateway_settings" ADD CONSTRAINT "payment_gateway_settings_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
