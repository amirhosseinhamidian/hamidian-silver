import { Injectable, Logger } from '@nestjs/common';
import { lockOrderRowForUpdate } from '../../common/order-row-lock';
import { Prisma } from '../../generated/prisma/client';
import type {
  WalletReconciliationCode,
  WalletReconciliationSubject,
} from '../../generated/prisma/enums';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { WalletCheckoutService } from './wallet-checkout.service';
import { bucketField } from './wallet-ledger';
import { WalletLedgerService } from './wallet-ledger.service';
import { classifyWalletReservation } from './wallet-reservation-reconciliation';

const batchSize = 50;
type Subject = { id: string; userId: string; orderId: string };
type LotCursor = { id: string; expiresAt: Date };
type ExpirableLot = LotCursor & { userId: string };
type LotAudit = Subject & { mismatch: boolean };

@Injectable()
export class WalletMaintenanceService {
  private readonly logger = new Logger(WalletMaintenanceService.name);

  constructor(
    private readonly db: PrismaService,
    private readonly ledger: WalletLedgerService,
    private readonly checkout: WalletCheckoutService,
  ) {}

  async expireBatch(after: LotCursor | null = null) {
    const lots = await this.db.$queryRaw<ExpirableLot[]>(Prisma.sql`
      SELECT lot."id", lot."userId", lot."expiresAt"
      FROM "wallet_lots" lot
      WHERE lot."expiresAt" <= CURRENT_TIMESTAMP
        AND (lot."pendingToman" > 0 OR lot."availableToman" > 0)
        AND NOT EXISTS (
          SELECT 1 FROM "wallet_reconciliation_issues" issue
          WHERE issue."subject" = 'LOT' AND issue."subjectId" = lot."id"
            AND issue."resolvedAt" IS NULL
        )
        ${after ? Prisma.sql`AND (lot."expiresAt", lot."id") > (${after.expiresAt}, ${after.id}::uuid)` : Prisma.empty}
      ORDER BY lot."expiresAt", lot."id"
      LIMIT ${batchSize}
    `);

    let expired = 0;
    let failed = 0;
    for (const lot of lots) {
      try {
        const operation = await this.ledger.expire({
          userId: lot.userId,
          lotId: lot.id,
          idempotencyKey: `maintenance:expire:${lot.id}`,
        });
        if (operation.movements.length) expired += 1;
      } catch (error) {
        failed += 1;
        this.logFailure('expiry', lot.id, error);
      }
    }
    return { next: lots.length === batchSize ? lots[batchSize - 1] : null, expired, failed };
  }

  async reconcileReservations(afterId: string | null = null, now = new Date()) {
    const reservations = await this.db.$queryRaw<Array<Pick<Subject, 'id' | 'orderId'>>>(Prisma.sql`
      SELECT "id", "orderId"
      FROM "wallet_reservations"
      WHERE "status" = 'RESERVED'
        ${afterId ? Prisma.sql`AND "id" > ${afterId}::uuid` : Prisma.empty}
      ORDER BY "id"
      LIMIT ${batchSize}
    `);

    let released = 0;
    let failed = 0;
    for (const reservation of reservations) {
      try {
        if (await this.reconcileReservation(reservation.id, reservation.orderId, now))
          released += 1;
      } catch (error) {
        failed += 1;
        this.logFailure('reservation reconciliation', reservation.id, error);
      }
    }

    // Settlement may have closed a reservation through its regular payment path.
    const resolved = await this.db.$executeRaw`
      UPDATE "wallet_reconciliation_issues" issue
      SET "resolvedAt" = CURRENT_TIMESTAMP
      WHERE issue."subject" = 'RESERVATION' AND issue."resolvedAt" IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM "wallet_reservations" reservation
          WHERE reservation."id" = issue."subjectId" AND reservation."status" = 'RESERVED'
        )
    `;

    return {
      next: reservations.length === batchSize ? reservations[batchSize - 1].id : null,
      released,
      resolved,
      failed,
    };
  }

  async reconcileLots(afterId: string | null = null) {
    const buckets = Object.entries(bucketField).map(
      ([bucket, field]) => Prisma.sql`(${bucket}::"WalletBucket", lot.${Prisma.raw(`"${field}"`)})`,
    );
    // One statement observes the lot and its append-only movements from the same snapshot.
    const lots = await this.db.$queryRaw<LotAudit[]>(Prisma.sql`
      SELECT lot."id", lot."userId", lot."orderId",
        EXISTS (
          SELECT 1
          FROM (VALUES ${Prisma.join(buckets)}) snapshot(bucket, amount)
          LEFT JOIN LATERAL (
            SELECT delta.bucket, SUM(delta.amount) AS amount
            FROM "wallet_ledger_entries" entry
            CROSS JOIN LATERAL (VALUES
              (entry."toBucket", entry."amountToman"),
              (entry."fromBucket", -entry."amountToman")
            ) delta(bucket, amount)
            WHERE entry."lotId" = lot."id"
            GROUP BY delta.bucket
          ) ledger ON ledger.bucket = snapshot.bucket
          WHERE snapshot.amount <> COALESCE(ledger.amount, 0)
        ) AS mismatch
      FROM (
        SELECT * FROM "wallet_lots"
        ${afterId ? Prisma.sql`WHERE "id" > ${afterId}::uuid` : Prisma.empty}
        ORDER BY "id"
        LIMIT ${batchSize}
      ) lot
      ORDER BY lot."id"
    `);

    const cleanIds = lots.filter((lot) => !lot.mismatch).map(({ id }) => id);
    if (cleanIds.length) {
      await this.db.walletReconciliationIssue.updateMany({
        where: { subject: 'LOT', subjectId: { in: cleanIds }, resolvedAt: null },
        data: { resolvedAt: new Date() },
      });
    }

    const mismatches = lots.filter((lot) => lot.mismatch);
    for (const lot of mismatches) {
      await this.recordIssue(this.db, 'LOT', lot, 'LEDGER_MISMATCH');
    }
    return {
      next: lots.length === batchSize ? lots[batchSize - 1].id : null,
      mismatches: mismatches.length,
    };
  }

  private async reconcileReservation(id: string, orderId: string, now: Date) {
    return this.db.$transaction(async (tx) => {
      await lockOrderRowForUpdate(tx, orderId);
      const reservation = await tx.walletReservation.findUnique({
        where: { id },
        select: {
          id: true,
          orderId: true,
          userId: true,
          amountToman: true,
          status: true,
          createdAt: true,
          order: {
            select: {
              id: true,
              userId: true,
              status: true,
              paidAt: true,
              walletAppliedToman: true,
              reservationExpiresAt: true,
              payment: {
                select: {
                  status: true,
                  paidAt: true,
                  attempts: { select: { status: true, updatedAt: true, failureCode: true } },
                },
              },
            },
          },
        },
      });
      if (reservation?.status !== 'RESERVED') return false;
      const [{ allocated }] = await tx.$queryRaw<Array<{ allocated: bigint }>>`
        SELECT COALESCE(SUM(
          CASE WHEN "toBucket" = 'RESERVED' THEN "amountToman" ELSE 0 END -
          CASE WHEN "fromBucket" = 'RESERVED' THEN "amountToman" ELSE 0 END
        ), 0) AS allocated
        FROM "wallet_ledger_entries"
        WHERE "reservationId" = ${id}::uuid
      `;
      const { order } = reservation;
      const decision = classifyWalletReservation(
        {
          order,
          payment: order.payment,
          attempts: order.payment?.attempts ?? [],
          reservationUserId: reservation.userId,
          reservationAmountToman: reservation.amountToman,
          reservedAt: reservation.createdAt,
          allocatedToman: allocated,
        },
        now,
      );
      if (decision !== 'KEEP' && decision !== 'RELEASE') {
        await this.recordIssue(tx, 'RESERVATION', reservation, decision);
        return false;
      }
      if (decision === 'RELEASE') await this.checkout.release(tx, order);
      await tx.walletReconciliationIssue.updateMany({
        where: { subject: 'RESERVATION', subjectId: id, resolvedAt: null },
        data: { resolvedAt: new Date() },
      });
      return decision === 'RELEASE';
    });
  }

  private async recordIssue(
    tx: Prisma.TransactionClient,
    subject: WalletReconciliationSubject,
    row: Subject,
    code: WalletReconciliationCode,
  ) {
    await tx.$executeRaw`
      INSERT INTO "wallet_reconciliation_issues"
        ("subject", "subjectId", "userId", "orderId", "code", "detectedAt")
      VALUES (
        ${subject}::"WalletReconciliationSubject", ${row.id}::uuid, ${row.userId}::uuid,
        ${row.orderId}::uuid, ${code}::"WalletReconciliationCode", CURRENT_TIMESTAMP
      )
      ON CONFLICT ("subject", "subjectId") DO UPDATE
        SET "code" = EXCLUDED."code",
            "detectedAt" = CASE WHEN "wallet_reconciliation_issues"."resolvedAt" IS NULL
              THEN "wallet_reconciliation_issues"."detectedAt" ELSE EXCLUDED."detectedAt" END,
            "resolvedAt" = NULL
        WHERE "wallet_reconciliation_issues"."code" <> EXCLUDED."code"
           OR "wallet_reconciliation_issues"."resolvedAt" IS NOT NULL
    `;
  }

  private logFailure(operation: string, id: string, error: unknown) {
    this.logger.error(
      `Wallet ${operation} failed for ${id} (${error instanceof Error ? error.name : 'UnknownError'}).`,
    );
  }
}
