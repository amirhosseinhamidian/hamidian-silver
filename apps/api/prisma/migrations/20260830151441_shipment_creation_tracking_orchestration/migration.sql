-- CreateEnum
CREATE TYPE "ShipmentProviderCreationState" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'CREATED', 'UNKNOWN');

-- AlterTable
ALTER TABLE "shipments" ADD COLUMN     "creationAttemptedAt" TIMESTAMPTZ(3),
ADD COLUMN     "lastProviderDescription" VARCHAR(500),
ADD COLUMN     "lastProviderStatus" VARCHAR(255),
ADD COLUMN     "lastTrackingSyncAt" TIMESTAMPTZ(3),
ADD COLUMN     "providerCreateError" VARCHAR(500),
ADD COLUMN     "providerCreationState" "ShipmentProviderCreationState" NOT NULL DEFAULT 'NOT_STARTED';

-- CreateIndex
CREATE INDEX "shipments_providerCreationState_creationAttemptedAt_idx" ON "shipments"("providerCreationState", "creationAttemptedAt");
