ALTER TABLE "orders" ADD COLUMN "purchaseRewardBasis" JSONB;

CREATE TYPE "PurchaseRewardJobStatus" AS ENUM (
  'PENDING', 'PROCESSING', 'WAITING', 'COMPLETED', 'SKIPPED', 'DEAD_LETTER'
);

CREATE TABLE "purchase_reward_jobs" (
  "orderId" UUID PRIMARY KEY REFERENCES "orders" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "userId" UUID NOT NULL,
  "sequence" BIGSERIAL NOT NULL UNIQUE,
  "paidAt" TIMESTAMPTZ(3) NOT NULL,
  "status" "PurchaseRewardJobStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0 CHECK ("attempts" >= 0),
  "nextAttemptAt" TIMESTAMPTZ(3) NOT NULL,
  "leaseUntil" TIMESTAMPTZ(3),
  "leaseToken" UUID,
  "resultCode" VARCHAR(48),
  "policyVersion" INTEGER REFERENCES "reward_policy_versions" ("version") ON DELETE RESTRICT ON UPDATE CASCADE,
  "calculation" JSONB,
  "finishedAt" TIMESTAMPTZ(3),
  CONSTRAINT "purchase_reward_jobs_lease" CHECK (
    ("status" = 'PROCESSING' AND "leaseUntil" IS NOT NULL AND "leaseToken" IS NOT NULL)
    OR ("status" <> 'PROCESSING' AND "leaseUntil" IS NULL AND "leaseToken" IS NULL)
  )
);

CREATE INDEX "purchase_reward_jobs_status_nextAttemptAt_sequence_idx"
  ON "purchase_reward_jobs" ("status", "nextAttemptAt", "sequence");
CREATE INDEX "purchase_reward_jobs_status_leaseUntil_idx"
  ON "purchase_reward_jobs" ("status", "leaseUntil");
CREATE INDEX "purchase_reward_jobs_userId_sequence_idx"
  ON "purchase_reward_jobs" ("userId", "sequence");

CREATE FUNCTION enqueue_purchase_reward_job() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- Serialize the ordering of concurrent confirmations for this customer.
  PERFORM pg_advisory_xact_lock(hashtextextended('purchase-reward-order:' || NEW."userId"::text, 0));
  INSERT INTO "purchase_reward_jobs" ("orderId", "userId", "paidAt", "nextAttemptAt")
    VALUES (NEW."id", NEW."userId", NEW."paidAt", clock_timestamp())
    ON CONFLICT ("orderId") DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "orders_enqueue_purchase_reward"
  AFTER UPDATE OF "paidAt" ON "orders"
  FOR EACH ROW
  WHEN (OLD."paidAt" IS NULL AND NEW."paidAt" IS NOT NULL AND NEW."status" = 'PAID')
  EXECUTE FUNCTION enqueue_purchase_reward_job();
