import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { isNonNegativeTomanInt } from '../../common/toman';
import { Prisma } from '../../generated/prisma/client';
import {
  WalletSource,
  type WalletBucket,
  type WalletOperationKind,
} from '../../generated/prisma/enums';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { enqueueWalletCreditActivation } from '../notifications/wallet-credit-notifications.service';
import type { WalletBalanceDto, WalletLedgerPageDto, WalletOperationDto } from './dto/wallet.dto';
import {
  allocateWalletAmount,
  bucketField,
  returnedWalletBucket,
  spendableWalletLots,
  type WalletCorrection,
  type WalletGrant,
  type WalletLotRequest,
  type WalletRequest,
  type WalletReservationRequest,
  type WalletReserve,
  type WalletReverseCapture,
  type WalletReverseGrant,
} from './wallet-ledger';

const pageSize = 25;
const includeMovements = {
  entries: {
    orderBy: [{ lot: { expiresAt: 'asc' } }, { lotId: 'asc' }, { id: 'asc' }],
    include: {
      lot: {
        select: {
          orderId: true,
          source: true,
          sourceKey: true,
          expiresAt: true,
          policyVersion: true,
          referralPolicyVersion: true,
        },
      },
      reservation: { select: { orderId: true } },
    },
  },
} satisfies Prisma.WalletOperationInclude;

type Operation = Prisma.WalletOperationGetPayload<{ include: typeof includeMovements }>;
type OperationContext = {
  db: Prisma.TransactionClient;
  operationId: string;
  now: Date;
  userId: string;
};
type ContextAction = (context: OperationContext) => Promise<void>;
type BalanceRow = {
  source: WalletSource | null;
  pending: bigint;
  available: bigint;
  reserved: bigint;
  expired: bigint;
  nextExpiryAt: Date | null;
  nextExpiryToman: bigint;
};

function operationDto(operation: Operation): WalletOperationDto {
  return {
    id: operation.id,
    kind: operation.kind,
    recordedAt: operation.recordedAt.toISOString(),
    actorUserId: operation.actorUserId,
    reason: operation.reason,
    movements: operation.entries.map((entry) => ({
      lotId: entry.lotId,
      originOrderId: entry.lot.orderId,
      source: entry.lot.source,
      sourceKey: entry.lot.sourceKey,
      policyVersion: (entry.lot.referralPolicyVersion ?? entry.lot.policyVersion)!,
      expiresAt: entry.lot.expiresAt.toISOString(),
      reservationId: entry.reservationId,
      reservationOrderId: entry.reservation?.orderId ?? null,
      amountToman: entry.amountToman,
      fromBucket: entry.fromBucket,
      toBucket: entry.toBucket,
    })),
  };
}

function assertAmount(amount: number) {
  if (!isNonNegativeTomanInt(amount) || amount === 0)
    throw new BadRequestException('Wallet amount must be positive integer toman.');
}

export function exactWalletToman(total: bigint) {
  const numeric = Number(total);
  if (!Number.isSafeInteger(numeric))
    throw new ServiceUnavailableException('Wallet balance exceeds the supported reporting range.');
  return numeric;
}

@Injectable()
export class WalletLedgerService {
  constructor(private readonly db: PrismaService) {}

  async lockAccount(tx: Prisma.TransactionClient, userId: string) {
    await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended('wallet:' || ${userId}::uuid::text, 0))`;
  }

  async balance(userId: string): Promise<WalletBalanceDto> {
    const rows = await this.db.$queryRaw<BalanceRow[]>`
      WITH lots AS (
        SELECT l.source, "pendingToman", CASE WHEN COALESCE(j."recoveryDueToman", 0) = 0 AND j."nextAttemptAt" IS NULL
            THEN "availableToman" ELSE 0 END AS "availableToman", "reservedToman", "expiresAt",
          "expiredToman" + CASE WHEN "expiresAt" <= CURRENT_TIMESTAMP
            THEN "pendingToman" + l."availableToman" ELSE 0 END AS expired,
          MIN("expiresAt") FILTER (WHERE "availableToman" > 0 AND "expiresAt" > CURRENT_TIMESTAMP
            AND COALESCE(j."recoveryDueToman", 0) = 0 AND j."nextAttemptAt" IS NULL)
            OVER () AS next_expiry
        FROM "wallet_lots" l LEFT JOIN "referral_grant_jobs" j ON j."lotId" = l.id
        WHERE l."userId" = ${userId}::uuid
      )
      SELECT
        source,
        COALESCE(SUM("pendingToman") FILTER (WHERE "expiresAt" > CURRENT_TIMESTAMP), 0) AS pending,
        COALESCE(SUM("availableToman") FILTER (WHERE "expiresAt" > CURRENT_TIMESTAMP), 0) AS available,
        COALESCE(SUM("reservedToman"), 0) AS reserved,
        COALESCE(SUM(expired), 0) AS expired,
        MIN(next_expiry) AS "nextExpiryAt",
        COALESCE(SUM("availableToman") FILTER (WHERE "expiresAt" = next_expiry), 0) AS "nextExpiryToman"
      FROM lots
      GROUP BY GROUPING SETS ((), (source))
    `;
    const balance = rows.find(({ source }) => source === null)!;
    return {
      pendingToman: exactWalletToman(balance.pending),
      availableToman: exactWalletToman(balance.available),
      reservedToman: exactWalletToman(balance.reserved),
      nextExpiryAt: balance.nextExpiryAt?.toISOString() ?? null,
      nextExpiryToman: exactWalletToman(balance.nextExpiryToman),
      sourceBalances: Object.values(WalletSource).map((source) => {
        const row = rows.find((entry) => entry.source === source);
        return {
          source,
          availableToman: exactWalletToman(row?.available ?? 0n),
          pendingToman: exactWalletToman(row?.pending ?? 0n),
          reservedToman: exactWalletToman(row?.reserved ?? 0n),
          expiredToman: exactWalletToman(row?.expired ?? 0n),
        };
      }),
    };
  }

  async history(userId: string, page: number): Promise<WalletLedgerPageDto> {
    const rows = await this.db.walletOperation.findMany({
      where: { userId },
      orderBy: { sequence: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize + 1,
      include: includeMovements,
    });
    return {
      items: rows.slice(0, pageSize).map(operationDto),
      page,
      hasMore: rows.length > pageSize,
    };
  }

  grant(input: WalletGrant, tx?: Prisma.TransactionClient) {
    assertAmount(input.amountToman);
    if (!Number.isFinite(input.expiresAt.valueOf()))
      throw new BadRequestException('Enter a valid wallet expiry.');
    this.assertKey(input.sourceKey);
    const version = input.referralPolicyVersion ?? input.policyVersion;
    if (version === undefined)
      throw new BadRequestException('A wallet grant needs a policy version.');
    const details = [
      input.orderId.toLowerCase(),
      ...(input.referralPolicyVersion === undefined ? [version] : ['referral-policy', version]),
      input.source,
      input.sourceKey,
      input.amountToman,
      input.expiresAt.toISOString(),
    ];
    return this.operate(
      'GRANT',
      input,
      details,
      async (context) => {
        const { db, now, userId } = context;
        if (input.expiresAt <= now)
          throw new BadRequestException('A wallet lot must expire in the future.');
        const [order, policy] = await Promise.all([
          db.order.findFirst({
            where: {
              id: input.orderId,
              ...(input.source === 'PURCHASE' ? { userId } : {}),
              status: { notIn: ['CANCELLED', 'EXPIRED'] },
              paidAt: { not: null },
              payment: { status: { in: ['PAID', 'PARTIALLY_REFUNDED'] } },
            },
            select: { id: true },
          }),
          input.referralPolicyVersion === undefined
            ? db.rewardPolicyVersion.findFirst({
                where: { version, effectiveAt: { lte: now } },
                select: { definition: true },
              })
            : db.referralRewardPolicyVersion.findFirst({
                where: {
                  version: input.referralPolicyVersion,
                  effectiveAt: { lte: now },
                  attributions: {
                    some: {
                      id: input.sourceKey,
                      referrerUserId: userId,
                      firstOrderId: input.orderId,
                    },
                  },
                },
                select: { definition: true },
              }),
        ]);
        const definition = policy?.definition;
        if (
          !order ||
          !definition ||
          typeof definition !== 'object' ||
          Array.isArray(definition) ||
          definition.enabled !== true
        )
          throw new ConflictException(
            'A wallet grant needs a paid order and an effective enabled policy.',
          );
        const lot = await db.walletLot.create({
          data: {
            userId,
            orderId: input.orderId,
            policyVersion: input.policyVersion,
            referralPolicyVersion: input.referralPolicyVersion,
            source: input.source,
            sourceKey: input.sourceKey,
            grantedToman: input.amountToman,
            pendingToman: input.amountToman,
            expiresAt: input.expiresAt,
            createdAt: now,
          },
          select: { id: true },
        });
        await this.move(context, lot.id, input.amountToman, null, 'PENDING');
      },
      tx,
    );
  }

  activate(input: WalletLotRequest, tx?: Prisma.TransactionClient) {
    return this.operate(
      'ACTIVATE',
      input,
      [input.lotId.toLowerCase()],
      async (context) => {
        const lot = await this.getLot(context, input.lotId);
        if (lot.activatedAt) return;
        if (lot.expiresAt <= context.now || lot.pendingToman === 0)
          throw new ConflictException('This lot has no pending credit to activate.');
        await this.move(context, lot.id, lot.pendingToman, 'PENDING', 'AVAILABLE');
        await context.db.walletLot.update({
          where: { id: lot.id },
          data: { activatedAt: context.now },
        });
        await enqueueWalletCreditActivation(context.db, context.userId, lot, context.now);
      },
      tx,
    );
  }

  reserve(input: WalletReserve, tx?: Prisma.TransactionClient) {
    assertAmount(input.amountToman);
    return this.operate(
      'RESERVE',
      input,
      [input.orderId.toLowerCase(), input.amountToman],
      async (context) => {
        const { db, userId, now } = context;
        const order = await db.order.findFirst({
          where: { id: input.orderId, userId, status: 'PENDING_PAYMENT' },
          select: { id: true },
        });
        if (!order) throw new ConflictException('This order cannot reserve wallet credit.');
        const previous = await db.walletReservation.findFirst({
          where: { orderId: input.orderId, status: { not: 'RELEASED' } },
          select: { id: true },
        });
        if (previous)
          throw new ConflictException('This order already has a live wallet reservation.');
        const lots = await db.walletLot.findMany({
          where: { ...spendableWalletLots(userId, now), availableToman: { gt: 0 } },
          orderBy: [{ expiresAt: 'asc' }, { id: 'asc' }],
          select: { id: true, availableToman: true },
        });
        const allocations = allocateWalletAmount(
          lots.map(({ id, availableToman }) => ({ id, capacity: availableToman })),
          input.amountToman,
        );
        if (!allocations) throw new ConflictException('Insufficient available wallet credit.');
        const reservation = await db.walletReservation.create({
          data: { userId, orderId: input.orderId, amountToman: input.amountToman, createdAt: now },
          select: { id: true },
        });
        for (const { source, amount } of allocations) {
          await this.move(context, source.id, amount, 'AVAILABLE', 'RESERVED', reservation.id);
        }
      },
      tx,
    );
  }

  release(input: WalletReservationRequest, tx?: Prisma.TransactionClient) {
    return this.settleReservation('RELEASE', input, tx);
  }

  capture(input: WalletReservationRequest, tx?: Prisma.TransactionClient) {
    return this.settleReservation('CAPTURE', input, tx);
  }

  expire(input: WalletLotRequest, tx?: Prisma.TransactionClient) {
    return this.operate(
      'EXPIRE',
      input,
      [input.lotId.toLowerCase()],
      async (context) => {
        const lot = await this.getLot(context, input.lotId);
        if (lot.expiresAt > context.now)
          throw new ConflictException('This wallet lot has not expired.');
        for (const bucket of ['PENDING', 'AVAILABLE'] as const) {
          const amount = lot[bucketField[bucket]];
          if (amount) await this.move(context, lot.id, amount, bucket, 'EXPIRED');
        }
      },
      tx,
    );
  }

  revokeGrant(input: WalletReverseGrant, tx?: Prisma.TransactionClient) {
    assertAmount(input.amountToman);
    return this.operate(
      'REVOKE_GRANT',
      input,
      [input.lotId.toLowerCase(), input.amountToman],
      async (context) => {
        const lot = await this.getLot(context, input.lotId);
        if (lot.expiresAt <= context.now)
          throw new ConflictException('Expired credit cannot be revoked. Record expiry instead.');
        const allocations = allocateWalletAmount(
          (['PENDING', 'AVAILABLE'] as const).map((bucket) => ({
            bucket,
            capacity: lot[bucketField[bucket]],
          })),
          input.amountToman,
        );
        if (!allocations)
          throw new ConflictException('This lot has insufficient unspent credit to revoke.');
        for (const { source, amount } of allocations) {
          await this.move(context, lot.id, amount, source.bucket, 'REVOKED');
        }
      },
      tx,
    );
  }

  reverseCapture(input: WalletReverseCapture, tx?: Prisma.TransactionClient) {
    assertAmount(input.amountToman);
    return this.operate(
      'REVERSE_CAPTURE',
      input,
      [input.reservationId.toLowerCase(), input.amountToman],
      async (context) => {
        const reservation = await this.getReservation(context, input.reservationId);
        if (reservation.status !== 'CAPTURED')
          throw new ConflictException('Only captured credit can be reversed.');
        const [captured, reversals] = await Promise.all([
          context.db.walletLedgerEntry.findMany({
            where: { reservationId: reservation.id, toBucket: 'CAPTURED' },
            orderBy: [{ lot: { expiresAt: 'asc' } }, { lotId: 'asc' }],
            select: { lotId: true, amountToman: true, lot: { select: { expiresAt: true } } },
          }),
          context.db.walletLedgerEntry.groupBy({
            by: ['lotId'],
            where: { reservationId: reservation.id, fromBucket: 'CAPTURED' },
            _sum: { amountToman: true },
          }),
        ]);
        const reversedByLot = new Map(
          reversals.map((row) => [row.lotId, row._sum.amountToman ?? 0]),
        );
        if (
          captured.reduce((sum, entry) => sum + entry.amountToman, 0) !== reservation.amountToman ||
          captured.some((entry) => (reversedByLot.get(entry.lotId) ?? 0) > entry.amountToman)
        )
          throw new ServiceUnavailableException(
            'Wallet capture movements do not match the reservation.',
          );
        const allocations = allocateWalletAmount(
          captured.map((entry) => ({
            ...entry,
            capacity: entry.amountToman - (reversedByLot.get(entry.lotId) ?? 0),
          })),
          input.amountToman,
        );
        if (!allocations)
          throw new ConflictException('The reversal exceeds the remaining capture for this order.');
        for (const { source, amount } of allocations) {
          await this.move(
            context,
            source.lotId,
            amount,
            'CAPTURED',
            returnedWalletBucket(context.now, source.lot.expiresAt),
            reservation.id,
          );
        }
      },
      tx,
    );
  }

  private settleReservation(
    kind: 'RELEASE' | 'CAPTURE',
    input: WalletReservationRequest,
    tx?: Prisma.TransactionClient,
  ) {
    return this.operate(
      kind,
      input,
      [input.reservationId.toLowerCase()],
      async (context) => {
        const { db, now } = context;
        const reservation = await this.getReservation(context, input.reservationId);
        if (reservation.status !== 'RESERVED')
          throw new ConflictException('This wallet reservation was already resolved.');
        const movements = await db.walletLedgerEntry.findMany({
          where: { reservationId: reservation.id, toBucket: 'RESERVED' },
          select: { lotId: true, amountToman: true, lot: { select: { expiresAt: true } } },
        });
        if (
          movements.reduce((sum, entry) => sum + entry.amountToman, 0) !== reservation.amountToman
        )
          throw new ServiceUnavailableException(
            'Wallet reservation movements do not match its amount.',
          );
        for (const entry of movements) {
          const destination =
            kind === 'CAPTURE' ? 'CAPTURED' : returnedWalletBucket(now, entry.lot.expiresAt);
          await this.move(
            context,
            entry.lotId,
            entry.amountToman,
            'RESERVED',
            destination,
            reservation.id,
          );
        }
        await db.walletReservation.update({
          where: { id: reservation.id },
          data: { status: kind === 'CAPTURE' ? 'CAPTURED' : 'RELEASED', resolvedAt: now },
        });
      },
      tx,
    );
  }

  private async operate(
    kind: WalletOperationKind,
    input: WalletRequest & Partial<WalletCorrection>,
    details: readonly (number | string)[],
    action: ContextAction,
    tx?: Prisma.TransactionClient,
  ): Promise<WalletOperationDto> {
    this.assertKey(input.idempotencyKey);
    const userId = input.userId.toLowerCase();
    const reason = input.reason?.trim() ?? null;
    const actorUserId = input.actorUserId?.toLowerCase() ?? null;
    if (
      (reason === null) !== (actorUserId === null) ||
      (reason !== null && (reason.length < 3 || reason.length > 250))
    )
      throw new BadRequestException('A manual wallet correction needs an actor and a reason.');
    const fingerprint = createHash('sha256')
      .update(JSON.stringify([kind, actorUserId, reason, ...details]))
      .digest('hex');
    const run = async (db: Prisma.TransactionClient) => {
      await this.lockAccount(db, userId);
      const where = { userId_idempotencyKey: { userId, idempotencyKey: input.idempotencyKey } };
      const existing = await db.walletOperation.findUnique({ where, include: includeMovements });
      if (existing) {
        if (existing.fingerprint !== fingerprint)
          throw new ConflictException(
            'This wallet request key was already used with different values.',
          );
        return operationDto(existing);
      }
      const [{ now }] = await db.$queryRaw<Array<{ now: Date }>>`
        SELECT clock_timestamp()::timestamptz(3) AS now
      `;
      const operation = await db.walletOperation.create({
        data: {
          userId,
          idempotencyKey: input.idempotencyKey,
          kind,
          fingerprint,
          actorUserId,
          reason,
          recordedAt: now,
        },
        select: { id: true },
      });
      await action({ db, now, userId, operationId: operation.id });
      return operationDto(
        await db.walletOperation.findUniqueOrThrow({ where, include: includeMovements }),
      );
    };
    try {
      return tx ? await run(tx) : await this.db.$transaction(run);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
        throw new ConflictException('This wallet source or reservation was already recorded.');
      throw error;
    }
  }

  private async getLot({ db, userId }: OperationContext, lotId: string) {
    const lot = await db.walletLot.findFirst({ where: { id: lotId, userId } });
    if (!lot) throw new NotFoundException('Wallet lot not found.');
    return lot;
  }

  private async getReservation({ db, userId }: OperationContext, reservationId: string) {
    const reservation = await db.walletReservation.findFirst({
      where: { id: reservationId, userId },
    });
    if (!reservation) throw new NotFoundException('Wallet reservation not found.');
    return reservation;
  }

  private async move(
    { db, operationId }: OperationContext,
    lotId: string,
    amountToman: number,
    fromBucket: WalletBucket | null,
    toBucket: WalletBucket,
    reservationId?: string,
  ) {
    if (fromBucket) {
      await db.walletLot.update({
        where: { id: lotId },
        data: {
          [bucketField[fromBucket]]: { decrement: amountToman },
          [bucketField[toBucket]]: { increment: amountToman },
        },
      });
    }
    await db.walletLedgerEntry.create({
      data: { operationId, lotId, reservationId, amountToman, fromBucket, toBucket },
    });
  }

  private assertKey(key: string) {
    if (!/^[a-zA-Z0-9_.:-]{1,128}$/.test(key))
      throw new BadRequestException('Invalid wallet idempotency or source key.');
  }
}
