import { Prisma, type Campaign } from '../../generated/prisma/client';
import { confirmedGrowthOrders } from '../growth-attribution/growth-revenue-events';

export function scopedCampaignOrders({ id, trackingId }: Pick<Campaign, 'id' | 'trackingId'>) {
  return Prisma.sql`
    WITH campaign_orders AS (
      SELECT "orderId" AS id, TRUE AS "discountApplied"
        FROM "order_price_quotes" WHERE "campaignId" = ${id}::uuid
      UNION ALL
      SELECT attribution."orderId", FALSE
        FROM "order_attributions" attribution
        WHERE attribution."campaignId" = ${trackingId} AND NOT EXISTS (
          SELECT 1 FROM "order_price_quotes" quote
          WHERE quote."orderId" = attribution."orderId" AND quote."campaignId" = ${id}::uuid
        )
    ), confirmed_orders AS NOT MATERIALIZED (${confirmedGrowthOrders}),
    classified AS (
      SELECT o.id, o."orderNumber" AS number, o."createdAt", o."reservationExpiresAt",
        confirmed."paidAt", confirmed."amountToman",
        campaign_orders."discountApplied",
        CASE
          WHEN p.status = 'RECONCILIATION_REQUIRED' OR EXISTS (
            SELECT 1 FROM "payment_attempts" a
            JOIN "payment_reconciliations" r ON r."paymentAttemptId" = a.id
            WHERE a."paymentId" = p.id AND r.status = 'OPEN'
          ) THEN 'RECONCILIATION'
          WHEN confirmed.id IS NOT NULL THEN 'CONFIRMED'
          WHEN o.status = 'CANCELLED' THEN 'CANCELLED'
          WHEN o.status = 'EXPIRED' THEN 'EXPIRED'
          WHEN p.status = 'AWAITING_REVIEW' THEN 'RECEIPT_REVIEW'
          WHEN latest."receiptRejectedAt" IS NOT NULL THEN 'RECEIPT_REJECTED'
          WHEN latest.status = 'FAILED' AND latest."failureCode" IS DISTINCT FROM 'PAYMENT_METHOD_CHANGED'
            THEN 'PAYMENT_FAILED'
          ELSE 'PENDING'
        END AS state,
        confirmed.id IS NOT NULL AS confirmed,
        o.status = 'PENDING_PAYMENT' AND (
          p.id IS NULL OR p.status IN ('PENDING', 'CANCELLED')
        ) AS "waitingForPayment"
      FROM campaign_orders
      JOIN "orders" o ON o.id = campaign_orders.id
      LEFT JOIN "payments" p ON p."orderId" = o.id
      LEFT JOIN confirmed_orders confirmed ON confirmed.id = o.id
      LEFT JOIN LATERAL (
        SELECT a.status, a."receiptRejectedAt", a."failureCode"
        FROM "payment_attempts" a WHERE a."paymentId" = p.id
        ORDER BY a."createdAt" DESC, a.id DESC LIMIT 1
      ) latest ON TRUE
    )
  `;
}
