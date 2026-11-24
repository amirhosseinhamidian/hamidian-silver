CREATE TYPE "ReferralRiskAction" AS ENUM ('ALLOW', 'REVIEW', 'HOLD', 'REJECT');
CREATE TYPE "ReferralRiskConfidence" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

CREATE TABLE "referral_risk_policy_versions" (
  "version" SERIAL PRIMARY KEY,
  "requestId" UUID NOT NULL UNIQUE,
  "definition" JSONB NOT NULL CHECK (jsonb_typeof("definition") = 'object'),
  "publishedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "publishedById" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "referral_risk_observations" (
  "userId" UUID PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "deviceHash" CHAR(64),
  "networkHash" CHAR(64),
  "recordedAt" TIMESTAMPTZ(3) NOT NULL
);
CREATE INDEX "referral_risk_observations_recordedAt_idx" ON "referral_risk_observations"("recordedAt");
CREATE INDEX "referral_risk_observations_deviceHash_recordedAt_idx" ON "referral_risk_observations"("deviceHash", "recordedAt");
CREATE INDEX "referral_risk_observations_networkHash_recordedAt_idx" ON "referral_risk_observations"("networkHash", "recordedAt");

CREATE TABLE "referral_risk_assessments" (
  "attributionId" UUID PRIMARY KEY REFERENCES "referral_attributions"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "orderId" UUID NOT NULL,
  "policyVersion" INT REFERENCES "referral_risk_policy_versions"("version") ON DELETE RESTRICT ON UPDATE CASCADE,
  "policySnapshot" JSONB NOT NULL CHECK (jsonb_typeof("policySnapshot") = 'object'),
  "autoAction" "ReferralRiskAction" NOT NULL,
  "action" "ReferralRiskAction" NOT NULL,
  "confidence" "ReferralRiskConfidence" NOT NULL,
  "score" INT NOT NULL CHECK ("score" BETWEEN 0 AND 900),
  "revision" INT NOT NULL DEFAULT 1 CHECK ("revision" > 0),
  "assessedAt" TIMESTAMPTZ(3) NOT NULL,
  "dueAt" TIMESTAMPTZ(3),
  "expiresAt" TIMESTAMPTZ(3) NOT NULL CHECK ("expiresAt" > "assessedAt"),
  "evidence" JSONB CHECK ("evidence" IS NULL OR jsonb_typeof("evidence") = 'array'),
  CONSTRAINT "referral_risk_review_due" CHECK (
    ("action" IN ('REVIEW', 'HOLD')) = ("dueAt" IS NOT NULL)
  )
);
CREATE INDEX "referral_risk_queue_idx" ON "referral_risk_assessments"("action", "dueAt", "assessedAt");
CREATE INDEX "referral_risk_assessments_expiresAt_idx" ON "referral_risk_assessments"("expiresAt");

CREATE TABLE "referral_risk_reviews" (
  "attributionId" UUID REFERENCES "referral_risk_assessments"("attributionId") ON DELETE RESTRICT ON UPDATE CASCADE,
  "revision" INT NOT NULL CHECK ("revision" > 1),
  "fromAction" "ReferralRiskAction" NOT NULL,
  "action" "ReferralRiskAction" NOT NULL,
  "reason" VARCHAR(250) NOT NULL CHECK (length(trim("reason")) >= 3),
  "actorUserId" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "recordedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("attributionId", "revision")
);

CREATE INDEX "referral_risk_candidates_idx" ON "referral_attributions"("firstPaidAt", "id")
  WHERE "firstOrderId" IS NOT NULL AND "rewardPolicyVersion" IS NOT NULL;
CREATE INDEX "payment_attempts_verified_reference_idx" ON "payment_attempts"("provider", "providerReference", "verifiedAt")
  WHERE "status" = 'VERIFIED' AND "providerReference" IS NOT NULL;

CREATE FUNCTION protect_referral_risk_audit() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Referral risk versions and review history are append-only';
END;
$$;
CREATE TRIGGER "referral_risk_policies_append_only" BEFORE UPDATE OR DELETE
  ON "referral_risk_policy_versions" FOR EACH ROW EXECUTE FUNCTION protect_referral_risk_audit();
CREATE TRIGGER "referral_risk_reviews_append_only" BEFORE UPDATE OR DELETE
  ON "referral_risk_reviews" FOR EACH ROW EXECUTE FUNCTION protect_referral_risk_audit();
