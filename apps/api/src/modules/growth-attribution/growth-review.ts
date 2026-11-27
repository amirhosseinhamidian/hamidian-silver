import { Prisma } from '../../generated/prisma/client';
import { growthReportPeriodSql } from './growth-revenue-events';
import { growthRevenuePeriod } from './growth-revenue.service';

type Period = { from: string; to: string };

export function growthReviewPeriods(values: readonly string[]) {
  if (values.length !== 4)
    throw new Error('Supply baseline-from baseline-to evaluation-from evaluation-to (YYYY-MM-DD).');
  const baseline = growthRevenuePeriod({ from: values[0], to: values[1] });
  const evaluation = growthRevenuePeriod({ from: values[2], to: values[3] });
  const span = (period: Period) => Date.parse(period.to) - Date.parse(period.from);
  if (baseline.to >= evaluation.from || span(baseline) !== span(evaluation))
    throw new Error(
      'Choose two non-overlapping periods of equal calendar duration, baseline first.',
    );
  return { baseline, evaluation };
}

// Align the retained-purchase population with the reward worker, not cash event counts.
const retainedPurchase = Prisma.sql`
  orders.status IN ('PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED')
  AND payment.status IN ('PAID', 'PARTIALLY_REFUNDED')
  AND orders."paidAt" IS NOT NULL
  AND EXISTS (SELECT 1 FROM "order_items" item
    WHERE item."orderId" = orders.id AND item."returnedQuantity" < item.quantity)
`;

export async function readGrowthReviewPeriod(tx: Prisma.TransactionClient, period: Period) {
  const [row] = await tx.$queryRaw<{ review: Record<string, unknown> }[]>`
    WITH report_period AS (
      ${growthReportPeriodSql(period)}
    ), in_period AS MATERIALIZED (
      SELECT orders.id, orders."userId", orders."paidAt", orders."discountTotalToman",
        orders."walletAppliedToman",
        payment."amountToman"::bigint - payment."refundedAmountToman" AS net_cash
      FROM "orders" orders JOIN "payments" payment ON payment."orderId" = orders.id
      CROSS JOIN report_period
      WHERE orders."paidAt" >= starts_at AND orders."paidAt" < LEAST(ends_before, CURRENT_TIMESTAMP)
        AND ${retainedPurchase}
    ), buyers AS (
      SELECT DISTINCT "userId" FROM in_period
    ), first_two AS MATERIALIZED (
      SELECT buyers."userId", (history.ids)[1] AS first_id,
        (history.paid)[1] AS first_paid, (history.paid)[2] AS second_paid
      FROM buyers CROSS JOIN LATERAL (
        SELECT ARRAY_AGG(old.id ORDER BY old."paidAt", old.id) AS ids,
          ARRAY_AGG(old."paidAt" ORDER BY old."paidAt", old.id) AS paid
        FROM (
          SELECT orders.id, orders."paidAt"
          FROM "orders" orders JOIN "payments" payment ON payment."orderId" = orders.id
          WHERE orders."userId" = buyers."userId" AND orders."paidAt" < CURRENT_TIMESTAMP
            AND ${retainedPurchase}
          ORDER BY orders."paidAt", orders.id LIMIT 2
        ) old
      ) history
    ), cohort AS (
      SELECT COUNT(*) AS first_buyers,
        COUNT(*) FILTER (WHERE second_paid <= first_paid + INTERVAL '720 hours') AS repeated,
        PERCENTILE_CONT(0.5) WITHIN GROUP (
          ORDER BY EXTRACT(EPOCH FROM (second_paid - first_paid))::double precision / 86400
        ) FILTER (WHERE second_paid <= first_paid + INTERVAL '720 hours') AS median_days
      FROM first_two CROSS JOIN report_period
      WHERE first_paid >= starts_at AND first_paid < ends_before
    ), repeat_orders AS MATERIALIZED (
      SELECT in_period.* FROM in_period JOIN first_two USING ("userId")
      WHERE in_period.id <> first_two.first_id
    ), repeat_cost AS (
      SELECT COUNT(*) AS purchases,
        COUNT(*) FILTER (WHERE quote."orderId" IS NOT NULL
          AND (orders."walletAppliedToman" = 0
            OR (movements.gross_spent = orders."walletAppliedToman" AND movements.net_spent >= 0))) AS covered,
        SUM(orders."discountTotalToman"::bigint + quote."shippingDiscountToman"
          + COALESCE(movements.net_spent, 0)) AS registered_incentives
      FROM repeat_orders orders
      LEFT JOIN "order_price_quotes" quote ON quote."orderId" = orders.id
      LEFT JOIN LATERAL (
        SELECT SUM(entry."amountToman") FILTER (WHERE entry."toBucket" = 'CAPTURED') AS gross_spent,
          SUM(CASE WHEN entry."toBucket" = 'CAPTURED' THEN entry."amountToman"::bigint
            WHEN entry."fromBucket" = 'CAPTURED' THEN -entry."amountToman"::bigint
            ELSE 0 END) AS net_spent
        FROM "wallet_reservations" reservation
        JOIN "wallet_ledger_entries" entry ON entry."reservationId" = reservation.id
        WHERE reservation."orderId" = orders.id
          AND (entry."toBucket" = 'CAPTURED' OR entry."fromBucket" = 'CAPTURED')
      ) movements ON orders."walletAppliedToman" > 0
    ), reward_lots AS (
      SELECT COALESCE(SUM(lot."grantedToman") FILTER (
          WHERE lot."createdAt" >= starts_at AND lot."createdAt" < ends_before), 0) AS issued,
        SUM(lot."grantedToman" - lot."revokedToman") FILTER (WHERE lot."activatedAt" >= starts_at
          AND lot."activatedAt" < ends_before) AS activated,
        SUM(lot."capturedToman") FILTER (WHERE lot."activatedAt" >= starts_at
          AND lot."activatedAt" < ends_before) AS used,
        SUM(lot."grantedToman" - lot."revokedToman") FILTER (WHERE lot."activatedAt" >= starts_at
          AND lot."activatedAt" < ends_before AND lot."expiresAt" <= CURRENT_TIMESTAMP) AS matured,
        SUM(lot."expiredToman") FILTER (WHERE lot."activatedAt" >= starts_at
          AND lot."activatedAt" < ends_before AND lot."expiresAt" <= CURRENT_TIMESTAMP) AS expired,
        COUNT(*) FILTER (WHERE lot."activatedAt" >= starts_at AND lot."activatedAt" < ends_before
          AND lot."expiresAt" <= CURRENT_TIMESTAMP
          AND (lot."pendingToman" > 0 OR lot."availableToman" > 0 OR lot."reservedToman" > 0)) AS unsettled
      FROM "wallet_lots" lot CROSS JOIN report_period WHERE lot.source = 'PURCHASE'
    ), referral AS (
      SELECT COUNT(*) AS paid, COUNT(*) FILTER (WHERE risk.action = 'ALLOW') AS risk_allowed,
        COUNT(*) FILTER (WHERE risk.action IN ('REVIEW', 'HOLD') OR risk.action IS NULL) AS risk_pending,
        COUNT(*) FILTER (WHERE risk.action = 'REJECT') AS risk_rejected
      FROM "referral_attributions" attribution
      JOIN in_period orders ON orders.id = attribution."firstOrderId"
      LEFT JOIN "referral_risk_assessments" risk
        ON risk."attributionId" = attribution.id AND risk."orderId" = orders.id
    ), cash AS (
      SELECT COUNT(*) AS purchases, COALESCE(SUM(net_cash), 0) AS amount FROM in_period
    ), traffic AS (
      SELECT NULLIF(COUNT(DISTINCT event."visitId"), 0) AS measured
      FROM "growth_funnel_events" event CROSS JOIN report_period
      WHERE event."recordedAt" >= starts_at AND event."recordedAt" < ends_before
    )
    SELECT jsonb_build_object(
      'completePeriod', ends_before <= CURRENT_TIMESTAMP,
      'cohortMature', ends_before + INTERVAL '720 hours' <= CURRENT_TIMESTAMP,
      'firstBuyers', first_buyers::text,
      'secondPurchaseWithin30Days', CASE WHEN ends_before + INTERVAL '720 hours' <= CURRENT_TIMESTAMP THEN repeated::text END,
      'secondPurchasePercent', CASE WHEN ends_before + INTERVAL '720 hours' <= CURRENT_TIMESTAMP
        THEN ROUND(100.0 * repeated / NULLIF(first_buyers, 0), 2)::text END,
      'medianDaysToSecondPurchase', CASE WHEN ends_before + INTERVAL '720 hours' <= CURRENT_TIMESTAMP
        THEN ROUND(median_days::numeric, 2)::text END,
      'retainedPurchases', cash.purchases::text,
      'repeatPurchases', repeat_cost.purchases::text,
      'repeatPurchasesWithCostEvidence', covered::text,
      'recordedIncentivePerRepeatPurchaseToman', CASE WHEN covered = repeat_cost.purchases
        THEN ROUND(registered_incentives / NULLIF(repeat_cost.purchases, 0), 0)::text END,
      'purchaseRewardIssuedToman', issued::text,
      'purchaseRewardActivatedNetToman', activated::text,
      'purchaseRewardConsumedNetToman', used::text,
      'purchaseRewardConsumedPercent', ROUND(100.0 * used / NULLIF(activated, 0), 2)::text,
      'purchaseRewardMaturedNetToman', matured::text,
      'purchaseRewardExpiredToman', expired::text,
      'expiredLotsAwaitingSettlement', unsettled::text,
      'purchaseRewardExpiredPercent', CASE WHEN unsettled = 0
        THEN ROUND(100.0 * expired / NULLIF(matured, 0), 2)::text END,
      'retainedNetCashToman', cash.amount::text,
      'issuedRewardToNetCashPercent', ROUND(100.0 * issued / NULLIF(cash.amount, 0), 2)::text,
      'referralPaidAndRetained', referral.paid::text,
      'referralRiskAllowed', referral.risk_allowed::text,
      'referralRiskPending', referral.risk_pending::text,
      'referralRiskRejected', referral.risk_rejected::text,
      'measuredVisits', traffic.measured::text,
      'giftFinderUsagePercent', NULL::text
    ) AS review
    FROM report_period CROSS JOIN cohort CROSS JOIN repeat_cost CROSS JOIN reward_lots
      CROSS JOIN referral CROSS JOIN cash CROSS JOIN traffic
  `;
  return row.review;
}

export async function readGrowthCreditCommitments(tx: Prisma.TransactionClient) {
  const [row] = await tx.$queryRaw<{ asOf: Date; commitment: Record<string, string> }[]>`
    SELECT CURRENT_TIMESTAMP AS "asOf", jsonb_build_object(
      'pendingToman', COALESCE(SUM("pendingToman") FILTER (WHERE "expiresAt" > CURRENT_TIMESTAMP), 0)::text,
      'availableToman', COALESCE(SUM("availableToman") FILTER (WHERE "expiresAt" > CURRENT_TIMESTAMP), 0)::text,
      'reservedToman', COALESCE(SUM("reservedToman"), 0)::text,
      'overduePendingOrAvailableToman', COALESCE(SUM("pendingToman"::bigint + "availableToman")
        FILTER (WHERE "expiresAt" <= CURRENT_TIMESTAMP), 0)::text
    ) AS commitment FROM "wallet_lots"
  `;
  return row;
}
