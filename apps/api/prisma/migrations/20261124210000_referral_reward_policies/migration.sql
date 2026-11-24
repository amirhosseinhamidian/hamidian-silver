CREATE TABLE "referral_reward_policy_versions" (
  "version" SERIAL PRIMARY KEY,
  "requestId" UUID NOT NULL UNIQUE,
  "definition" JSONB NOT NULL CHECK (jsonb_typeof("definition") = 'object'),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdById" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "requestedEffectiveAt" TIMESTAMPTZ(3),
  "publishedAt" TIMESTAMPTZ(3),
  "publishedById" UUID REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "effectiveAt" TIMESTAMPTZ(3),
  CONSTRAINT "referral_reward_policy_publication_valid" CHECK (
    ("publishedAt" IS NULL AND "publishedById" IS NULL AND "effectiveAt" IS NULL)
    OR (
      "publishedAt" IS NOT NULL AND "publishedById" IS NOT NULL AND "effectiveAt" IS NOT NULL
      AND "effectiveAt" >= "publishedAt"
      AND ("requestedEffectiveAt" IS NULL OR "requestedEffectiveAt" = "effectiveAt")
    )
  )
);

CREATE INDEX "referral_reward_policy_versions_effectiveAt_version_idx"
  ON "referral_reward_policy_versions"("effectiveAt", "version");

ALTER TABLE "referral_attributions"
  ADD COLUMN "rewardPolicyVersion" INT REFERENCES "referral_reward_policy_versions"("version")
    ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "referral_attributions_rewardPolicyVersion_idx" ON "referral_attributions"("rewardPolicyVersion");

CREATE FUNCTION protect_referral_reward_policy_version() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."publishedAt" IS NOT NULL THEN
    RAISE EXCEPTION 'Published referral reward policy versions are immutable';
  END IF;
  IF TG_OP = 'UPDATE' AND (
    NEW."version" <> OLD."version"
    OR NEW."requestId" <> OLD."requestId"
    OR NEW."definition" <> OLD."definition"
    OR NEW."createdAt" <> OLD."createdAt"
    OR NEW."createdById" <> OLD."createdById"
    OR NEW."requestedEffectiveAt" IS DISTINCT FROM OLD."requestedEffectiveAt"
  ) THEN
    RAISE EXCEPTION 'Save policy changes as a new draft';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "referral_reward_policy_immutability"
  BEFORE UPDATE OR DELETE ON "referral_reward_policy_versions"
  FOR EACH ROW EXECUTE FUNCTION protect_referral_reward_policy_version();

CREATE FUNCTION protect_referral_reward_policy_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Referral reward policy snapshots cannot change';
END;
$$;

CREATE TRIGGER "referral_reward_policy_snapshot_immutability"
  BEFORE UPDATE OF "rewardPolicyVersion" ON "referral_attributions"
  FOR EACH ROW WHEN (NEW."rewardPolicyVersion" IS DISTINCT FROM OLD."rewardPolicyVersion")
  EXECUTE FUNCTION protect_referral_reward_policy_snapshot();
