CREATE FUNCTION wake_waiting_purchase_reward(reward_order_id uuid, ready_to_check_at timestamptz)
RETURNS void LANGUAGE sql AS $$
  UPDATE "purchase_reward_jobs"
  SET "nextAttemptAt" = ready_to_check_at
  WHERE "orderId" = reward_order_id
    AND "status" = 'WAITING'
    AND "resultCode" IS NULL
    AND "nextAttemptAt" > ready_to_check_at;
$$;

CREATE FUNCTION wake_purchase_reward_on_delivery() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM wake_waiting_purchase_reward(NEW."id", NEW."deliveredAt");
  RETURN NEW;
END;
$$;

CREATE TRIGGER "orders_wake_purchase_reward_on_delivery"
  AFTER UPDATE OF "deliveredAt" ON "orders"
  FOR EACH ROW
  WHEN (OLD."deliveredAt" IS NULL AND NEW."deliveredAt" IS NOT NULL AND NEW."status" = 'DELIVERED')
  EXECUTE FUNCTION wake_purchase_reward_on_delivery();

CREATE FUNCTION wake_purchase_reward_on_return_resolution() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM wake_waiting_purchase_reward(NEW."orderId", clock_timestamp());
  RETURN NEW;
END;
$$;

CREATE TRIGGER "order_returns_wake_purchase_reward_on_resolution"
  AFTER UPDATE OF "status" ON "order_returns"
  FOR EACH ROW
  WHEN (OLD."status" = 'REQUESTED' AND NEW."status" IN ('RECEIVED', 'CANCELLED'))
  EXECUTE FUNCTION wake_purchase_reward_on_return_resolution();
