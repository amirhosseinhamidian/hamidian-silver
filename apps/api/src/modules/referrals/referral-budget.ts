import type { Prisma } from '../../generated/prisma/client';

export function lockReferralBudget(tx: Prisma.TransactionClient, version: number, month: Date) {
  return tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(
    'referral-budget:' || ${version}::text || ':' || to_char(${month}::timestamptz AT TIME ZONE 'Asia/Tehran', 'YYYY-MM'), 0))`;
}

export function referralBudgetUsage(
  tx: Prisma.TransactionClient,
  userId: string,
  version: number,
  at: Date,
) {
  return tx.$queryRaw<{ ruleCode: string; committed: bigint; uses: bigint }[]>`
    WITH month AS (
      SELECT date_trunc('month', ${at}::timestamptz AT TIME ZONE 'Asia/Tehran') AS start
    ), commitments AS (
      SELECT o."referralCheckoutRuleCode" AS code, o."referralDiscountToman" AS amount, o."userId" AS recipient
      FROM "orders" o JOIN "referral_attributions" a ON a.id = o."referralCheckoutAttributionId"
      CROSS JOIN month
      WHERE a."rewardPolicyVersion" = ${version}
        AND o."referralCheckoutReleasedAt" IS NULL
        AND (o."paidAt" IS NOT NULL OR o.status NOT IN ('CANCELLED', 'EXPIRED'))
        AND o."createdAt" >= (month.start AT TIME ZONE 'Asia/Tehran')
        AND o."createdAt" < ((month.start + interval '1 month') AT TIME ZONE 'Asia/Tehran')
      UNION ALL
      SELECT j."ruleCode", l."grantedToman", l."userId"
      FROM "referral_grant_jobs" j JOIN "wallet_lots" l ON l.id = j."lotId"
      CROSS JOIN month
      WHERE l."referralPolicyVersion" = ${version}
        AND j."budgetAt" >= (month.start AT TIME ZONE 'Asia/Tehran')
        AND j."budgetAt" < ((month.start + interval '1 month') AT TIME ZONE 'Asia/Tehran')
    )
    SELECT code AS "ruleCode", SUM(amount)::bigint AS committed,
      COUNT(*) FILTER (WHERE recipient = ${userId}::uuid) AS uses
    FROM commitments GROUP BY code
  `;
}
