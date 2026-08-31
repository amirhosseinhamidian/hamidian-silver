-- Stage 055: enforce financial invariants at the PostgreSQL boundary.
-- Prisma does not currently model these CHECK constraints in schema.prisma.

ALTER TABLE "products"
  ADD CONSTRAINT "products_sale_price_nonnegative"
  CHECK ("salePriceToman" IS NULL OR "salePriceToman" >= 0);

ALTER TABLE "product_suppliers"
  ADD CONSTRAINT "product_suppliers_price_nonnegative"
  CHECK ("supplierPriceToman" >= 0);

ALTER TABLE "product_price_history"
  ADD CONSTRAINT "product_price_history_prices_nonnegative"
  CHECK (
    ("previousPriceToman" IS NULL OR "previousPriceToman" >= 0)
    AND "newPriceToman" >= 0
  );

ALTER TABLE "plating_rates"
  ADD CONSTRAINT "plating_rates_financial_values_valid"
  CHECK (
    "pricePerGramToman" >= 0
    AND "leadTimeDays" >= 0
    AND "leadTimeDays" <= 365
  );

ALTER TABLE "plating_rate_history"
  ADD CONSTRAINT "plating_rate_history_values_valid"
  CHECK (
    ("previousPricePerGramToman" IS NULL OR "previousPricePerGramToman" >= 0)
    AND "newPricePerGramToman" >= 0
    AND ("previousLeadTimeDays" IS NULL OR "previousLeadTimeDays" >= 0)
    AND "newLeadTimeDays" >= 0
    AND "newLeadTimeDays" <= 365
  );

ALTER TABLE "order_plating_fulfillments"
  ADD CONSTRAINT "order_plating_fulfillments_actual_cost_nonnegative"
  CHECK ("actualCostToman" IS NULL OR "actualCostToman" >= 0);

ALTER TABLE "orders"
  ADD CONSTRAINT "orders_financial_amounts_nonnegative"
  CHECK (
    "merchandiseTotalToman" >= 0
    AND "platingTotalToman" >= 0
    AND "discountTotalToman" >= 0
    AND "shippingTotalToman" >= 0
    AND "taxTotalToman" >= 0
    AND "grandTotalToman" >= 0
  ),
  ADD CONSTRAINT "orders_discount_within_sales"
  CHECK (
    "discountTotalToman"::bigint
    <= "merchandiseTotalToman"::bigint + "platingTotalToman"::bigint
  ),
  ADD CONSTRAINT "orders_grand_total_consistent"
  CHECK (
    "grandTotalToman"::bigint
    =
      "merchandiseTotalToman"::bigint
      + "platingTotalToman"::bigint
      - "discountTotalToman"::bigint
      + "shippingTotalToman"::bigint
      + "taxTotalToman"::bigint
  );

ALTER TABLE "order_items"
  ADD CONSTRAINT "order_items_quantity_positive"
  CHECK ("quantity" > 0),
  ADD CONSTRAINT "order_items_financial_amounts_nonnegative"
  CHECK (
    "unitSalePriceToman" >= 0
    AND ("unitSupplierPriceToman" IS NULL OR "unitSupplierPriceToman" >= 0)
    AND ("platingRateToman" IS NULL OR "platingRateToman" >= 0)
    AND "unitPlatingPriceToman" >= 0
    AND "lineTotalToman" >= 0
  ),
  ADD CONSTRAINT "order_items_supplier_snapshot_complete"
  CHECK (
    (
      "unitSupplierPriceToman" IS NULL
      AND "supplierIdSnapshot" IS NULL
      AND "supplierNameSnapshot" IS NULL
    )
    OR
    (
      "unitSupplierPriceToman" IS NOT NULL
      AND "supplierIdSnapshot" IS NOT NULL
      AND "supplierNameSnapshot" IS NOT NULL
    )
  ),
  ADD CONSTRAINT "order_items_return_quantities_valid"
  CHECK (
    "returnAllocatedQuantity" >= 0
    AND "returnedQuantity" >= 0
    AND "returnAllocatedQuantity" <= "quantity"
    AND "returnedQuantity" <= "quantity"
  ),
  ADD CONSTRAINT "order_items_line_total_consistent"
  CHECK (
    "lineTotalToman"::bigint
    =
      "quantity"::bigint
      * ("unitSalePriceToman"::bigint + "unitPlatingPriceToman"::bigint)
  );

ALTER TABLE "order_return_items"
  ADD CONSTRAINT "order_return_items_quantity_positive"
  CHECK ("quantity" > 0);

ALTER TABLE "shipments"
  ADD CONSTRAINT "shipments_shipping_cost_nonnegative"
  CHECK ("shippingCostToman" >= 0);

ALTER TABLE "payments"
  ADD CONSTRAINT "payments_amounts_consistent"
  CHECK (
    "amountToman" >= 0
    AND "refundedAmountToman" >= 0
    AND "refundAllocatedToman" >= 0
    AND "refundedAmountToman" <= "refundAllocatedToman"
    AND "refundAllocatedToman" <= "amountToman"
  );

ALTER TABLE "payment_refunds"
  ADD CONSTRAINT "payment_refunds_amount_positive"
  CHECK ("amountToman" > 0);

ALTER TABLE "payment_attempts"
  ADD CONSTRAINT "payment_attempts_amount_nonnegative"
  CHECK ("amountToman" >= 0);

ALTER TABLE "payment_reconciliations"
  ADD CONSTRAINT "payment_reconciliations_amount_nonnegative"
  CHECK ("amountToman" >= 0);

ALTER TABLE "order_cost_entries"
  ADD CONSTRAINT "order_cost_entries_reversal_amount_semantics"
  CHECK (
    ("reversalOfId" IS NULL AND "amountToman" >= 0)
    OR
    ("reversalOfId" IS NOT NULL AND "amountToman" <= 0)
  ),
  ADD CONSTRAINT "order_cost_entries_not_self_reversal"
  CHECK ("reversalOfId" IS NULL OR "reversalOfId" <> "id");

ALTER TABLE "order_finance_snapshots"
  ADD CONSTRAINT "order_finance_snapshots_nonnegative_amounts"
  CHECK (
    "snapshotVersion" >= 1
    AND "merchandiseRevenueToman" >= 0
    AND "platingRevenueToman" >= 0
    AND "discountToman" >= 0
    AND "shippingChargedToman" >= 0
    AND "taxToman" >= 0
    AND "customerTotalToman" >= 0
    AND "supplierCostToman" >= 0
    AND "grossSalesToman" >= 0
    AND "netSalesToman" >= 0
  ),
  ADD CONSTRAINT "order_finance_snapshots_formulas_consistent"
  CHECK (
    "grossSalesToman"::bigint
      = "merchandiseRevenueToman"::bigint + "platingRevenueToman"::bigint
    AND "netSalesToman"::bigint
      = "grossSalesToman"::bigint - "discountToman"::bigint
    AND "customerTotalToman"::bigint
      =
        "netSalesToman"::bigint
        + "shippingChargedToman"::bigint
        + "taxToman"::bigint
    AND "grossMarginBeforeServiceCostsToman"::bigint
      = "netSalesToman"::bigint - "supplierCostToman"::bigint
  );

ALTER TABLE "supplier_payables"
  ADD CONSTRAINT "supplier_payables_amounts_valid"
  CHECK (
    "quantity" > 0
    AND "unitSupplierPriceToman" >= 0
    AND "amountToman" >= 0
    AND "amountToman"::bigint
      = "quantity"::bigint * "unitSupplierPriceToman"::bigint
  );

ALTER TABLE "supplier_credits"
  ADD CONSTRAINT "supplier_credits_amounts_valid"
  CHECK (
    "quantity" > 0
    AND "unitSupplierPriceToman" >= 0
    AND "amountToman" >= 0
    AND "appliedAmountToman" >= 0
    AND "appliedAmountToman" <= "amountToman"
    AND "amountToman"::bigint
      = "quantity"::bigint * "unitSupplierPriceToman"::bigint
  );

ALTER TABLE "supplier_settlements"
  ADD CONSTRAINT "supplier_settlements_amounts_valid"
  CHECK (
    "totalAmountToman" >= 0
    AND "creditAppliedToman" >= 0
    AND "creditAppliedToman" <= "totalAmountToman"
    AND ("paidAmountToman" IS NULL OR "paidAmountToman" >= 0)
    AND ("paidAmountToman" IS NULL OR "paidAmountToman" <= "totalAmountToman")
    AND "payableCount" > 0
  );

ALTER TABLE "supplier_credit_applications"
  ADD CONSTRAINT "supplier_credit_applications_amount_positive"
  CHECK ("amountToman" > 0);

ALTER TABLE "supplier_settlement_items"
  ADD CONSTRAINT "supplier_settlement_items_amount_nonnegative"
  CHECK ("amountToman" >= 0);
