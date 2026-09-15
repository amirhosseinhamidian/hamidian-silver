ALTER TABLE "product_price_history"
ADD COLUMN "previousCompareAtPriceToman" INTEGER,
ADD COLUMN "newCompareAtPriceToman" INTEGER;

ALTER TABLE "product_price_history"
ADD CONSTRAINT "product_price_history_previous_compare_at_non_negative"
CHECK ("previousCompareAtPriceToman" IS NULL OR "previousCompareAtPriceToman" >= 0),
ADD CONSTRAINT "product_price_history_new_compare_at_non_negative"
CHECK ("newCompareAtPriceToman" IS NULL OR "newCompareAtPriceToman" >= 0);
