import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import type { WalletMaintenanceReportDto } from './dto/wallet-maintenance.dto';
import { exactWalletToman } from './wallet-ledger.service';

const pageSize = 25;
type TotalsRow = {
  asOf: Date;
  available: bigint;
  pending: bigint;
  reserved: bigint;
  expired: bigint;
  captured: bigint;
  revoked: bigint;
  awaitingExpiry: bigint;
};

@Injectable()
export class WalletMaintenanceReportService {
  constructor(
    private readonly db: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async report(page: number, status: 'open' | 'resolved'): Promise<WalletMaintenanceReportDto> {
    const [{ asOf, available, pending, reserved, expired, captured, revoked, awaitingExpiry }] =
      await this.db.$queryRaw<TotalsRow[]>`
        SELECT CURRENT_TIMESTAMP AS "asOf",
          COALESCE(SUM("availableToman") FILTER (WHERE "expiresAt" > CURRENT_TIMESTAMP), 0) AS available,
          COALESCE(SUM("pendingToman") FILTER (WHERE "expiresAt" > CURRENT_TIMESTAMP), 0) AS pending,
          COALESCE(SUM("reservedToman"), 0) AS reserved,
          COALESCE(SUM("expiredToman"), 0) AS expired,
          COALESCE(SUM("capturedToman"), 0) AS captured,
          COALESCE(SUM("revokedToman"), 0) AS revoked,
          COALESCE(SUM("pendingToman"::bigint + "availableToman") FILTER (
            WHERE "expiresAt" <= CURRENT_TIMESTAMP
          ), 0)::bigint AS "awaitingExpiry"
        FROM "wallet_lots"
      `;
    const issues = await this.db.walletReconciliationIssue.findMany({
      where: { resolvedAt: status === 'open' ? null : { not: null } },
      orderBy: [{ detectedAt: 'desc' }, { subject: 'desc' }, { subjectId: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize + 1,
    });
    const items = issues.slice(0, pageSize);
    const orders = await this.db.order.findMany({
      where: { id: { in: items.map(({ orderId }) => orderId) } },
      select: { id: true, orderNumber: true },
    });
    const orderNumbers = new Map(orders.map(({ id, orderNumber }) => [id, orderNumber]));
    return {
      asOf: asOf.toISOString(),
      enabled: this.config.get<boolean>('WALLET_MAINTENANCE_ENABLED', false) === true,
      totals: {
        availableToman: exactWalletToman(available),
        pendingToman: exactWalletToman(pending),
        reservedToman: exactWalletToman(reserved),
        expiredToman: exactWalletToman(expired),
        capturedToman: exactWalletToman(captured),
        revokedToman: exactWalletToman(revoked),
        awaitingExpiryToman: exactWalletToman(awaitingExpiry),
      },
      issues: items.map(({ detectedAt, resolvedAt, ...issue }) => ({
        ...issue,
        orderNumber: orderNumbers.get(issue.orderId) ?? null,
        detectedAt: detectedAt.toISOString(),
        resolvedAt: resolvedAt?.toISOString() ?? null,
      })),
      page,
      hasMore: issues.length > pageSize,
    };
  }
}
