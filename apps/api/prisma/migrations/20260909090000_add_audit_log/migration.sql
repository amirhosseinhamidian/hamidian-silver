CREATE TYPE "AuditOutcome" AS ENUM ('SUCCESS', 'FAILURE');

CREATE TABLE "audit_logs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "actorUserId" UUID NOT NULL,
  "action" VARCHAR(180) NOT NULL,
  "resource" VARCHAR(80) NOT NULL,
  "resourceId" UUID,
  "method" VARCHAR(10) NOT NULL,
  "path" VARCHAR(500) NOT NULL,
  "statusCode" INTEGER NOT NULL,
  "outcome" "AuditOutcome" NOT NULL,
  "ipAddress" VARCHAR(64),
  "userAgent" VARCHAR(500),
  "requestId" VARCHAR(120),
  "durationMs" INTEGER NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");
CREATE INDEX "audit_logs_actorUserId_createdAt_idx" ON "audit_logs"("actorUserId", "createdAt");
CREATE INDEX "audit_logs_outcome_createdAt_idx" ON "audit_logs"("outcome", "createdAt");
CREATE INDEX "audit_logs_resource_resourceId_createdAt_idx" ON "audit_logs"("resource", "resourceId", "createdAt");
CREATE INDEX "audit_logs_action_createdAt_idx" ON "audit_logs"("action", "createdAt");

ALTER TABLE "audit_logs"
  ADD CONSTRAINT "audit_logs_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION prevent_audit_log_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_logs_append_only
BEFORE UPDATE OR DELETE ON "audit_logs"
FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();
