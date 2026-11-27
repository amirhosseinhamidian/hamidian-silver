CREATE TABLE "referral_codes" (
  "userId" UUID PRIMARY KEY REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "code" VARCHAR(24) NOT NULL UNIQUE CHECK ("code" ~ '^[A-Za-z0-9_-]{24}$'),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "referral_attributions" (
  "id" UUID PRIMARY KEY,
  "referrerUserId" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "referredUserId" UUID NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "policySnapshot" JSONB NOT NULL CHECK (jsonb_typeof("policySnapshot") = 'object'),
  "claimedAt" TIMESTAMPTZ(3) NOT NULL,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  "firstOrderId" UUID UNIQUE REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "firstPaidAt" TIMESTAMPTZ(3),
  CONSTRAINT "referral_attributions_distinct_accounts" CHECK ("referrerUserId" <> "referredUserId"),
  CONSTRAINT "referral_attributions_valid_window" CHECK ("expiresAt" > "claimedAt"),
  CONSTRAINT "referral_attributions_order_evidence" CHECK (("firstOrderId" IS NULL) = ("firstPaidAt" IS NULL))
);

CREATE INDEX "referral_attributions_history_idx"
  ON "referral_attributions"("referrerUserId", "claimedAt", "id");

CREATE INDEX "orders_userId_paidAt_referral_idx" ON "orders"("userId", "paidAt")
  WHERE "paidAt" IS NOT NULL;

CREATE TABLE "referral_request_limits" (
  "userId" UUID PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "windowStartAt" TIMESTAMPTZ(3) NOT NULL,
  "attempts" INTEGER NOT NULL CHECK ("attempts" BETWEEN 1 AND 10)
);

CREATE FUNCTION record_referral_first_payment() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  customer_id UUID;
BEGIN
  SELECT "userId" INTO customer_id FROM "orders"
  WHERE "id" = NEW."orderId" AND "paidAt" = NEW."paidAt";
  IF customer_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- The order payment outbox takes this same lock before confirming the payment.
  PERFORM pg_advisory_xact_lock(hashtextextended('purchase-reward-order:' || customer_id::text, 0));
  UPDATE "referral_attributions"
    SET "firstOrderId" = NEW."orderId", "firstPaidAt" = NEW."paidAt"
    WHERE "referredUserId" = customer_id AND "firstOrderId" IS NULL;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "payments_record_referral_first_payment"
  AFTER INSERT OR UPDATE OF "status", "paidAt" ON "payments"
  FOR EACH ROW WHEN (NEW."status" = 'PAID' AND NEW."paidAt" IS NOT NULL)
  EXECUTE FUNCTION record_referral_first_payment();
