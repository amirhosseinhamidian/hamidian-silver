-- CreateEnum
CREATE TYPE "OperationalIncidentResolutionSource" AS ENUM ('AUTO');

-- CreateEnum
CREATE TYPE "OperationalIncidentActivityType" AS ENUM ('DETECTED', 'ACKNOWLEDGED', 'ASSIGNED', 'UNASSIGNED', 'NOTE_ADDED', 'RESOLVED', 'REOPENED');

-- CreateTable
CREATE TABLE "operational_incidents" (
    "id" UUID NOT NULL,
    "incidentFingerprint" VARCHAR(180) NOT NULL,
    "orderId" UUID NOT NULL,
    "code" VARCHAR(80) NOT NULL,
    "priority" VARCHAR(16) NOT NULL,
    "incidentAt" TIMESTAMPTZ(3) NOT NULL,
    "dueAt" TIMESTAMPTZ(3),
    "firstDetectedAt" TIMESTAMPTZ(3) NOT NULL,
    "lastDetectedAt" TIMESTAMPTZ(3) NOT NULL,
    "acknowledgedAt" TIMESTAMPTZ(3),
    "acknowledgedByUserId" UUID,
    "assignedToUserId" UUID,
    "resolvedAt" TIMESTAMPTZ(3),
    "resolutionSource" "OperationalIncidentResolutionSource",
    "resolutionNote" VARCHAR(1000),
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "operational_incidents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operational_incident_activities" (
    "id" UUID NOT NULL,
    "incidentId" UUID NOT NULL,
    "type" "OperationalIncidentActivityType" NOT NULL,
    "actorUserId" UUID,
    "note" VARCHAR(1000),
    "metadata" JSONB NOT NULL,
    "activityKey" VARCHAR(255),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "operational_incident_activities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "operational_incidents_incidentFingerprint_key" ON "operational_incidents"("incidentFingerprint");

-- CreateIndex
CREATE INDEX "operational_incidents_resolvedAt_priority_lastDetectedAt_idx" ON "operational_incidents"("resolvedAt", "priority", "lastDetectedAt");

-- CreateIndex
CREATE INDEX "operational_incidents_code_resolvedAt_lastDetectedAt_idx" ON "operational_incidents"("code", "resolvedAt", "lastDetectedAt");

-- CreateIndex
CREATE INDEX "operational_incidents_assignedToUserId_resolvedAt_idx" ON "operational_incidents"("assignedToUserId", "resolvedAt");

-- CreateIndex
CREATE INDEX "operational_incidents_acknowledgedByUserId_idx" ON "operational_incidents"("acknowledgedByUserId");

-- CreateIndex
CREATE INDEX "operational_incidents_orderId_createdAt_idx" ON "operational_incidents"("orderId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "operational_incident_activities_activityKey_key" ON "operational_incident_activities"("activityKey");

-- CreateIndex
CREATE INDEX "operational_incident_activities_incidentId_createdAt_idx" ON "operational_incident_activities"("incidentId", "createdAt");

-- CreateIndex
CREATE INDEX "operational_incident_activities_actorUserId_idx" ON "operational_incident_activities"("actorUserId");

-- CreateIndex
CREATE INDEX "operational_incident_activities_type_createdAt_idx" ON "operational_incident_activities"("type", "createdAt");

-- AddForeignKey
ALTER TABLE "operational_incidents" ADD CONSTRAINT "operational_incidents_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operational_incidents" ADD CONSTRAINT "operational_incidents_acknowledgedByUserId_fkey" FOREIGN KEY ("acknowledgedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operational_incidents" ADD CONSTRAINT "operational_incidents_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operational_incident_activities" ADD CONSTRAINT "operational_incident_activities_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "operational_incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operational_incident_activities" ADD CONSTRAINT "operational_incident_activities_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
