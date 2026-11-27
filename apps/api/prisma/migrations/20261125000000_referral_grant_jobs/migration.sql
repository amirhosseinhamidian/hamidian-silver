ALTER TABLE "wallet_lots"
  ALTER COLUMN "policyVersion" DROP NOT NULL,
  ADD COLUMN "referralPolicyVersion" INT REFERENCES "referral_reward_policy_versions"("version") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "wallet_lots_single_policy" CHECK (
    ("policyVersion" IS NOT NULL AND "referralPolicyVersion" IS NULL)
    OR ("policyVersion" IS NULL AND "referralPolicyVersion" IS NOT NULL AND source = 'REFERRAL')
  );
CREATE INDEX "wallet_lots_referralPolicyVersion_idx" ON "wallet_lots"("referralPolicyVersion");

ALTER TABLE "order_price_quotes"
  ADD COLUMN "referralRewardToman" INT NOT NULL DEFAULT 0 CHECK ("referralRewardToman" >= 0);

CREATE TYPE "ReferralGrantStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED');
CREATE TABLE "referral_grant_jobs" (
  "attributionId" UUID PRIMARY KEY REFERENCES "referral_attributions"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  status "ReferralGrantStatus" NOT NULL DEFAULT 'PENDING',
  "nextAttemptAt" TIMESTAMPTZ(3),
  attempts INT NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  "resultCode" VARCHAR(48),
  "processedAt" TIMESTAMPTZ(3),
  "budgetAt" TIMESTAMPTZ(3),
  "ruleCode" VARCHAR(40),
  "riskRevision" INT,
  calculation JSONB,
  "lotId" UUID UNIQUE REFERENCES "wallet_lots"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "revocationToman" INT NOT NULL DEFAULT 0 CHECK ("revocationToman" >= 0),
  "recoveryDueToman" INT NOT NULL DEFAULT 0 CHECK (
    "recoveryDueToman" >= 0 AND "recoveryDueToman" <= "revocationToman"
  ),
  CONSTRAINT "referral_grant_snapshot_valid" CHECK (
    "lotId" IS NULL OR ("budgetAt" IS NOT NULL AND "ruleCode" IS NOT NULL AND calculation IS NOT NULL)
  )
);
CREATE INDEX "referral_grant_jobs_nextAttemptAt_attributionId_idx"
  ON "referral_grant_jobs"("nextAttemptAt", "attributionId");
CREATE INDEX "referral_grant_jobs_budgetAt_idx" ON "referral_grant_jobs"("budgetAt");
CREATE INDEX "referral_attributions_claimedAt_id_idx" ON "referral_attributions"("claimedAt", id);

CREATE FUNCTION protect_referral_grant_calculation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."lotId" IS NOT NULL AND
     (NEW."lotId", NEW."budgetAt", NEW."ruleCode", NEW.calculation)
       IS DISTINCT FROM
     (OLD."lotId", OLD."budgetAt", OLD."ruleCode", OLD.calculation) THEN
    RAISE EXCEPTION 'A recorded referral grant calculation cannot change';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "referral_grant_calculation_immutable"
  BEFORE UPDATE OF "lotId", "budgetAt", "ruleCode", calculation ON "referral_grant_jobs"
  FOR EACH ROW EXECUTE FUNCTION protect_referral_grant_calculation();

CREATE FUNCTION enqueue_referral_grant() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."firstOrderId" IS NOT NULL AND NEW."rewardPolicyVersion" IS NOT NULL THEN
    INSERT INTO "referral_grant_jobs" ("attributionId", "nextAttemptAt")
      VALUES (NEW.id, clock_timestamp())
      ON CONFLICT ("attributionId") DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "referral_attribution_enqueue_grant"
  AFTER INSERT OR UPDATE OF "firstOrderId" ON "referral_attributions"
  FOR EACH ROW EXECUTE FUNCTION enqueue_referral_grant();

CREATE FUNCTION wake_referral_grant_for_order() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE purchase_id UUID;
BEGIN
  IF TG_TABLE_NAME = 'orders' THEN purchase_id := NEW.id;
  ELSE purchase_id := NEW."orderId";
  END IF;
  UPDATE "referral_grant_jobs" j SET "nextAttemptAt" = clock_timestamp(), attempts = 0
  FROM "referral_attributions" a
  WHERE a."firstOrderId" = purchase_id AND a.id = j."attributionId";
  RETURN NEW;
END;
$$;
CREATE TRIGGER "order_wake_referral_grant"
  AFTER UPDATE OF status, "deliveredAt" ON "orders"
  FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status OR OLD."deliveredAt" IS DISTINCT FROM NEW."deliveredAt")
  EXECUTE FUNCTION wake_referral_grant_for_order();
CREATE TRIGGER "payment_wake_referral_grant"
  AFTER UPDATE OF status, "refundedAmountToman" ON "payments"
  FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status OR OLD."refundedAmountToman" IS DISTINCT FROM NEW."refundedAmountToman")
  EXECUTE FUNCTION wake_referral_grant_for_order();
CREATE TRIGGER "order_item_wake_referral_grant"
  AFTER UPDATE OF "returnedQuantity" ON "order_items"
  FOR EACH ROW WHEN (OLD."returnedQuantity" IS DISTINCT FROM NEW."returnedQuantity")
  EXECUTE FUNCTION wake_referral_grant_for_order();
CREATE TRIGGER "order_return_wake_referral_grant"
  AFTER INSERT OR UPDATE OF status ON "order_returns"
  FOR EACH ROW EXECUTE FUNCTION wake_referral_grant_for_order();

CREATE FUNCTION wake_referral_grant_for_risk() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE "referral_grant_jobs" SET "nextAttemptAt" = clock_timestamp(), attempts = 0
  WHERE "attributionId" = NEW."attributionId";
  RETURN NEW;
END;
$$;
CREATE TRIGGER "referral_risk_wake_grant"
  AFTER INSERT OR UPDATE OF revision ON "referral_risk_assessments"
  FOR EACH ROW EXECUTE FUNCTION wake_referral_grant_for_risk();

INSERT INTO "referral_grant_jobs" ("attributionId", "nextAttemptAt")
SELECT id, clock_timestamp() FROM "referral_attributions"
WHERE "firstOrderId" IS NOT NULL AND "rewardPolicyVersion" IS NOT NULL
ON CONFLICT ("attributionId") DO NOTHING;
