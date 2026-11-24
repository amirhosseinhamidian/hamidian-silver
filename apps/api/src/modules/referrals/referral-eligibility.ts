import type { Prisma } from '../../generated/prisma/client';

export async function findQualifyingReferralPurchase(
  db: Prisma.TransactionClient,
  userId: string,
  completedBy: Date,
) {
  const [order] = await db.$queryRaw<Array<{ id: string }>>`
    SELECT o.id FROM "orders" o JOIN "payments" p ON p."orderId" = o.id
    WHERE o."userId" = ${userId}::uuid AND o.status = 'DELIVERED'
      AND o."paidAt" <= ${completedBy} AND o."deliveredAt" <= ${completedBy}
      AND p.status IN ('PAID', 'PARTIALLY_REFUNDED')
      AND EXISTS (
        SELECT 1 FROM "order_items" item
        WHERE item."orderId" = o.id AND item."returnedQuantity" < item.quantity
      )
    ORDER BY o."deliveredAt", o.id LIMIT 1
  `;
  return order ?? null;
}

export async function lockReferralBuyer(tx: Prisma.TransactionClient, userId: string) {
  await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended('purchase-reward-order:' || ${userId}::uuid::text, 0))`;
}
