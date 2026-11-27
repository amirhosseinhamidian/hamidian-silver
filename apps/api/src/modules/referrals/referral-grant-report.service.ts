import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { exactWalletToman } from '../wallet/wallet-ledger.service';
import type { ReferralGrantQueryDto, ReferralGrantReportDto } from './dto/referral-grant.dto';

const pageSize = 25;
type Totals = ReferralGrantReportDto['totals'];
type Row = Omit<ReferralGrantReportDto['items'][number], 'claimedAt' | 'creditExpiresAt'> & {
  claimedAt: Date;
  creditExpiresAt: Date | null;
};

@Injectable()
export class ReferralGrantReportService {
  constructor(private readonly db: PrismaService) {}

  async report(query: ReferralGrantQueryDto, now = new Date()): Promise<ReferralGrantReportDto> {
    const page = query.page ?? 1;
    const since = new Date(+now - (query.days ?? 30) * 86_400_000);
    const cohort = Prisma.sql`
      WITH referrals AS (
        SELECT a.id, a."firstOrderId" AS "orderId", a."claimedAt",
          (o.status = 'DELIVERED' AND p.status IN ('PAID', 'PARTIALLY_REFUNDED')
            AND o."deliveredAt" <= ${now} AND a."firstPaidAt" BETWEEN a."claimedAt" AND ${now}
            AND (a."firstPaidAt" < a."expiresAt" OR o."referralCheckoutAttributionId" = a.id)
            AND EXISTS (SELECT 1 FROM "order_items" i WHERE i."orderId" = o.id AND i."returnedQuantity" < i.quantity)
          ) AS converted,
          CASE
            WHEN j.status = 'APPROVED' AND l."expiresAt" <= ${now} THEN 'EXPIRED'
            WHEN j.status IS NOT NULL THEN j.status
            WHEN a."firstOrderId" IS NOT NULL AND a."rewardPolicyVersion" IS NULL THEN 'REJECTED'
            WHEN a."expiresAt" <= ${now} THEN 'EXPIRED'
            ELSE 'PENDING'
          END AS status,
          r.action AS "riskAction", a."rewardPolicyVersion" AS "policyVersion",
          j."ruleCode", j."resultCode", l."expiresAt" AS "creditExpiresAt",
          COALESCE(l."grantedToman", 0) AS "grantedToman",
          COALESCE(o."referralDiscountToman", 0) AS "buyerDiscountToman",
          COALESCE(l."revokedToman", 0) AS "revokedToman",
          COALESCE(j."recoveryDueToman", 0) AS "recoveryDueToman"
        FROM "referral_attributions" a
        LEFT JOIN "referral_grant_jobs" j ON j."attributionId" = a.id
        LEFT JOIN "referral_risk_assessments" r ON r."attributionId" = a.id
        LEFT JOIN "wallet_lots" l ON l.id = j."lotId"
        LEFT JOIN "orders" o ON o.id = a."firstOrderId"
        LEFT JOIN "payments" p ON p."orderId" = o.id
        WHERE a."claimedAt" >= ${since} AND a."claimedAt" <= ${now}
      )
    `;
    return this.db.$transaction(
      async (tx) => {
        const [totals] = await tx.$queryRaw<Record<keyof Totals, bigint>[]>`
        ${cohort}
        SELECT COUNT(*) AS registered,
          COUNT(*) FILTER (WHERE converted) AS converted,
          COUNT(*) FILTER (WHERE status = 'PENDING') AS pending,
          COUNT(*) FILTER (WHERE status = 'APPROVED') AS approved,
          COUNT(*) FILTER (WHERE status = 'REJECTED') AS rejected,
          COUNT(*) FILTER (WHERE status = 'EXPIRED') AS expired,
          COUNT(*) FILTER (WHERE "riskAction" IN ('REVIEW', 'HOLD', 'REJECT')) AS flagged,
          COALESCE(SUM("grantedToman"), 0) AS "grantedToman",
          COALESCE(SUM("buyerDiscountToman"), 0) AS "buyerDiscountToman",
          COALESCE(SUM("revokedToman"), 0) AS "revokedToman",
          COALESCE(SUM("recoveryDueToman"), 0) AS "recoveryDueToman"
        FROM referrals
      `;
        const rows = await tx.$queryRaw<Row[]>`
        ${cohort}
        SELECT id, "orderId", "claimedAt", status, "riskAction", "policyVersion", "ruleCode",
          "resultCode", "creditExpiresAt", "grantedToman", "buyerDiscountToman", "revokedToman", "recoveryDueToman"
        FROM referrals
        ${query.status ? Prisma.sql`WHERE status = ${query.status}::"ReferralGrantStatus"` : Prisma.empty}
        ORDER BY "claimedAt" DESC, id DESC
        LIMIT ${pageSize + 1} OFFSET ${(page - 1) * pageSize}
      `;
        return {
          totals: {
            registered: exactWalletToman(totals.registered),
            converted: exactWalletToman(totals.converted),
            pending: exactWalletToman(totals.pending),
            approved: exactWalletToman(totals.approved),
            rejected: exactWalletToman(totals.rejected),
            expired: exactWalletToman(totals.expired),
            flagged: exactWalletToman(totals.flagged),
            grantedToman: exactWalletToman(totals.grantedToman),
            buyerDiscountToman: exactWalletToman(totals.buyerDiscountToman),
            revokedToman: exactWalletToman(totals.revokedToman),
            recoveryDueToman: exactWalletToman(totals.recoveryDueToman),
          },
          items: rows.slice(0, pageSize).map(({ claimedAt, creditExpiresAt, ...row }) => ({
            ...row,
            claimedAt: claimedAt.toISOString(),
            creditExpiresAt: creditExpiresAt?.toISOString() ?? null,
          })),
          page,
          hasMore: rows.length > pageSize,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
}
