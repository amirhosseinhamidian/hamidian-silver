ALTER TABLE "orders"
  ADD COLUMN "walletAppliedToman" INTEGER NOT NULL DEFAULT 0,
  DROP CONSTRAINT "orders_grand_total_consistent",
  ADD CONSTRAINT "orders_grand_total_consistent"
    CHECK ("grandTotalToman"::bigint = "merchandiseTotalToman"::bigint + "platingTotalToman"
      - "discountTotalToman" + "shippingTotalToman" + "taxTotalToman" - "walletAppliedToman"),
  ADD CONSTRAINT "orders_wallet_checkout_amount_check"
    CHECK ("walletAppliedToman" = 0 OR ("walletAppliedToman" > 0 AND "grandTotalToman" >= 10000
      AND "walletAppliedToman"::bigint <= "merchandiseTotalToman"::bigint - "discountTotalToman"));

ALTER TABLE "order_items"
  ADD COLUMN "walletAppliedToman" INTEGER NOT NULL DEFAULT 0,
  ADD CONSTRAINT "order_items_wallet_checkout_amount_check"
    CHECK ("walletAppliedToman" BETWEEN 0 AND "unitSalePriceToman"::bigint * "quantity");

ALTER TABLE "order_finance_snapshots"
  ADD COLUMN "walletAppliedToman" INTEGER NOT NULL DEFAULT 0 CHECK ("walletAppliedToman" >= 0),
  DROP CONSTRAINT "order_finance_snapshots_formulas_consistent",
  ADD CONSTRAINT "order_finance_snapshots_formulas_consistent"
    CHECK (
      "grossSalesToman"::bigint = "merchandiseRevenueToman"::bigint + "platingRevenueToman"
      AND "netSalesToman"::bigint = "grossSalesToman"::bigint - "discountToman"
      AND "customerTotalToman"::bigint = "netSalesToman"::bigint + "shippingChargedToman"
        + "taxToman" - "walletAppliedToman"
      AND "grossMarginBeforeServiceCostsToman"::bigint = "netSalesToman"::bigint - "supplierCostToman"
    );
