ALTER TABLE "shipping_carriers"
  ADD COLUMN "subtitle" VARCHAR(240);

ALTER TABLE "shipping_carriers"
  ADD CONSTRAINT "shipping_carriers_subtitle_valid"
  CHECK (
    "subtitle" IS NULL
    OR char_length(btrim("subtitle")) BETWEEN 2 AND 240
  );

-- Existing carriers remain usable and can be completed from admin without data loss.
