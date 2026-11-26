import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Prisma, type SavedCart } from '../../generated/prisma/client';
import { PlatingType } from '../../generated/prisma/enums';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { attachHumanAuditEvent } from '../audit/audit-event';
import { loadRecoveryItems } from './cart-recovery-pricing';
import type { CreateOrderItemDto } from './dto/create-order.dto';
import type {
  SaveCartDto,
  SavedCartPolicyDto,
  SavedCartReportDto,
  SavedCartReviewDto,
  SavedCartStatusDto,
  SavedCartVersionDto,
} from './dto/cart-recovery.dto';

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
const siteId = 'site';
const defaultPolicy: SavedCartPolicyDto = {
  remindersEnabled: true,
  idleHours: 24,
  retentionDays: 14,
};
type Reader = Pick<Prisma.TransactionClient, 'savedCart' | 'siteSettings'>;
type StoredItem = {
  variantId: string;
  quantity: number;
  platingType?: PlatingType;
  productName: string;
  previousUnitToman: number;
};
const closedData = { activeUserId: null, items: [], fingerprint: '0'.repeat(64) };

function fingerprint(
  items: readonly { variantId: string; quantity: number; platingType?: PlatingType | null }[],
) {
  const lines = items.map(
    ({ variantId, quantity, platingType }) =>
      `${variantId.toLowerCase()}/${platingType ?? ''}/${quantity}`,
  );
  return createHash('sha256').update(lines.sort().join('|')).digest('hex');
}

function storedItems(cart: SavedCart): StoredItem[] {
  if (!Array.isArray(cart.items)) return [];
  return cart.items.flatMap((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
    const { variantId, quantity, platingType, productName, previousUnitToman } = entry;
    if (
      typeof variantId !== 'string' ||
      typeof quantity !== 'number' ||
      typeof productName !== 'string' ||
      typeof previousUnitToman !== 'number'
    )
      return [];
    const plating = Object.values(PlatingType).find((value) => value === platingType);
    return [
      {
        variantId,
        quantity,
        productName,
        previousUnitToman,
        ...(plating ? { platingType: plating } : {}),
      },
    ];
  });
}

function abandonment(cart: SavedCart, now: Date) {
  return cart.abandonedAt ?? (cart.eligibleAt <= now ? cart.eligibleAt : null);
}

function summarize(
  cart: SavedCart | null,
  policy: SavedCartPolicyDto,
  now: Date,
): SavedCartStatusDto {
  if (!cart || cart.expiresAt <= now) {
    return { current: null, itemCount: 0, expiresAt: null, showReminder: false };
  }
  return {
    current: { cartId: cart.id, revision: cart.revision },
    itemCount: storedItems(cart).reduce((sum, line) => sum + line.quantity, 0),
    expiresAt: cart.expiresAt.toISOString(),
    showReminder:
      policy.remindersEnabled && !cart.hiddenAt && !cart.restoredAt && cart.eligibleAt <= now,
  };
}

@Injectable()
export class CartRecoveryService {
  constructor(private readonly db: PrismaService) {}

  private async policy(reader: Reader): Promise<SavedCartPolicyDto> {
    const settings = await reader.siteSettings.findUnique({
      where: { id: siteId },
      select: {
        cartRecoveryRemindersEnabled: true,
        cartRecoveryIdleHours: true,
        cartRecoveryRetentionDays: true,
      },
    });
    return settings
      ? {
          remindersEnabled: settings.cartRecoveryRemindersEnabled,
          idleHours: settings.cartRecoveryIdleHours,
          retentionDays: settings.cartRecoveryRetentionDays,
        }
      : defaultPolicy;
  }

  private async lock(tx: Prisma.TransactionClient, userId: string) {
    await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${`saved-cart:${userId}`}, 0))`;
  }

  private active(reader: Reader, userId: string) {
    return reader.savedCart.findUnique({ where: { activeUserId: userId } });
  }

  private assertVersion(cart: SavedCart | null, version: SavedCartVersionDto | undefined) {
    if (cart?.id !== version?.cartId || cart?.revision !== version?.revision)
      throw new ConflictException('The saved cart changed. Refresh it and try again.');
  }

  async status(userId: string, now = new Date()) {
    const [cart, policy] = await Promise.all([this.active(this.db, userId), this.policy(this.db)]);
    return summarize(cart, policy, now);
  }

  async save(userId: string, input: SaveCartDto, now = new Date()): Promise<SavedCartStatusDto> {
    return this.db.$transaction(async (tx) => {
      await this.lock(tx, userId);
      const policy = await this.policy(tx);
      let cart = await this.active(tx, userId);
      if (cart && cart.expiresAt <= now) {
        await tx.savedCart.update({
          where: { id: cart.id },
          data: {
            ...closedData,
            closedAt: now,
            abandonedAt: abandonment(cart, now),
          },
        });
        cart = null;
      }
      const cartFingerprint = fingerprint(input.items);
      if (cart?.fingerprint === cartFingerprint) return summarize(cart, policy, now);
      this.assertVersion(cart, input.current);
      const pending = await tx.order.findMany({
        where: { userId, status: 'PENDING_PAYMENT', reservationExpiresAt: { gt: now } },
        take: 25,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: { items: { select: { variantId: true, quantity: true, platingType: true } } },
      });
      if (pending.some(({ items }) => fingerprint(items) === cartFingerprint))
        throw new ConflictException('A pending order already contains this cart.');
      const selections = input.items.map(({ variantId, quantity, platingType }) => ({
        variantId: variantId.toLowerCase(),
        quantity,
        ...(platingType ? { platingType } : {}),
      }));
      const prices = await loadRecoveryItems(tx, selections);
      const items = selections.map((selection, i): StoredItem => {
        const item = prices[i];
        if (!item) throw new BadRequestException('Some cart items cannot be saved.');
        return {
          ...selection,
          productName: item.productName,
          previousUnitToman: item.unitSalePriceToman + item.unitPlatingPriceToman,
        };
      });
      const times = {
        savedAt: now,
        eligibleAt: new Date(+now + policy.idleHours * HOUR_MS),
        expiresAt: new Date(+now + policy.retentionDays * DAY_MS),
      };
      if (cart?.restoredAt || (cart && abandonment(cart, now))) {
        await tx.savedCart.update({
          where: { id: cart.id },
          data: { ...closedData, closedAt: now, abandonedAt: abandonment(cart, now) },
        });
        cart = null;
      }
      const saved = cart
        ? await tx.savedCart.update({
            where: { id: cart.id },
            data: {
              ...times,
              items,
              fingerprint: cartFingerprint,
              hiddenAt: null,
              revision: { increment: 1 },
            },
          })
        : await tx.savedCart.create({
            data: { ...times, userId, activeUserId: userId, items, fingerprint: cartFingerprint },
          });
      return summarize(saved, policy, now);
    });
  }

  async review(
    userId: string,
    version: SavedCartVersionDto,
    acceptedKey?: string,
    now = new Date(),
  ): Promise<SavedCartReviewDto> {
    return this.db.$transaction(async (tx) => {
      if (acceptedKey) await this.lock(tx, userId);
      const cart = await this.active(tx, userId);
      this.assertVersion(cart, version);
      if (!cart || cart.expiresAt <= now) throw new ConflictException('The saved cart expired.');
      const items = storedItems(cart);
      const prices = await loadRecoveryItems(tx, items);
      const lines = items.map((stored, index) => {
        const item = prices[index];
        return {
          productName: item?.productName ?? stored.productName,
          previousQuantity: stored.quantity,
          previousUnitToman: stored.previousUnitToman,
          item: item && item.quantity > 0 ? item : null,
        };
      });
      const reviewKey = createHash('sha256').update(JSON.stringify(lines)).digest('hex');
      const applied = acceptedKey === reviewKey && lines.some(({ item }) => item !== null);
      if (applied && !cart.restoredAt) {
        await tx.savedCart.update({
          where: { id: cart.id },
          data: { restoredAt: now, abandonedAt: abandonment(cart, now) },
        });
      }
      return { lines, reviewKey, applied };
    });
  }

  async dismiss(userId: string, version: SavedCartVersionDto, discard: boolean, now = new Date()) {
    return this.db.$transaction(async (tx) => {
      await this.lock(tx, userId);
      const policy = await this.policy(tx);
      const cart = await this.active(tx, userId);
      this.assertVersion(cart, version);
      if (!cart || cart.expiresAt <= now) throw new ConflictException('The saved cart expired.');
      const updated = await tx.savedCart.update({
        where: { id: cart.id },
        data: discard
          ? { ...closedData, closedAt: now, abandonedAt: abandonment(cart, now) }
          : { hiddenAt: now },
      });
      return summarize(discard ? null : updated, policy, now);
    });
  }

  async closeForOrder(
    tx: Prisma.TransactionClient,
    input: {
      userId: string;
      orderId: string;
      cartId?: string;
      revision?: number;
      items: CreateOrderItemDto[];
    },
    now = new Date(),
  ) {
    await this.lock(tx, input.userId);
    const cart = await this.active(tx, input.userId);
    if (!cart) return;
    const restored =
      cart.restoredAt && cart.id === input.cartId && cart.revision === input.revision;
    if (!restored && cart.fingerprint !== fingerprint(input.items)) return;
    const expired = cart.expiresAt <= now;
    await tx.savedCart.update({
      where: { id: cart.id },
      data: {
        ...closedData,
        closedAt: now,
        abandonedAt: abandonment(cart, now),
        ...(expired ? {} : { orderId: input.orderId }),
      },
    });
  }

  async report(now = new Date()): Promise<SavedCartReportDto> {
    const policy = await this.policy(this.db);
    const from = new Date(+now - 30 * DAY_MS);
    const recent: Prisma.SavedCartWhereInput = { savedAt: { gte: from, lte: now } };
    const abandoned: Prisma.SavedCartWhereInput = {
      ...recent,
      OR: [{ abandonedAt: { not: null } }, { closedAt: null, eligibleAt: { lte: now } }],
    };
    const restored = { ...abandoned, restoredAt: { not: null } };
    const [saved, abandonedCount, restoredCount, ordered, paid] = await this.db.$transaction(
      [
        this.db.savedCart.count({ where: recent }),
        this.db.savedCart.count({ where: abandoned }),
        this.db.savedCart.count({ where: restored }),
        this.db.savedCart.count({ where: { ...restored, orderId: { not: null } } }),
        this.db.savedCart.count({ where: { ...restored, order: { paidAt: { not: null } } } }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    return { policy, saved, abandoned: abandonedCount, restored: restoredCount, ordered, paid };
  }

  async expireBatch(now = new Date()) {
    await this.db.$executeRaw`
      WITH candidates AS MATERIALIZED (
        SELECT id, "userId" FROM "saved_carts"
        WHERE "closedAt" IS NULL AND "expiresAt" <= ${now}
        ORDER BY "expiresAt", id LIMIT 200
      )
      UPDATE "saved_carts" AS cart
      SET "activeUserId" = NULL, items = '[]'::jsonb, fingerprint = ${closedData.fingerprint},
        "closedAt" = ${now}, "abandonedAt" = COALESCE(cart."abandonedAt", cart."eligibleAt")
      FROM candidates
      WHERE cart.id = candidates.id AND cart."closedAt" IS NULL AND cart."expiresAt" <= ${now}
        AND pg_try_advisory_xact_lock(hashtextextended('saved-cart:' || candidates."userId"::text, 0))
    `;
  }

  async updatePolicy(policy: SavedCartPolicyDto, actorId: string) {
    if (policy.idleHours >= 24 * policy.retentionDays)
      throw new BadRequestException('Cart inactivity must be shorter than its retention.');
    const data = {
      cartRecoveryRemindersEnabled: policy.remindersEnabled,
      cartRecoveryIdleHours: policy.idleHours,
      cartRecoveryRetentionDays: policy.retentionDays,
      updatedByUserId: actorId,
    };
    const previous = await this.db.$transaction(async (tx) => {
      await this.lock(tx, 'policy');
      const previous = await this.policy(tx);
      await tx.siteSettings.upsert({
        where: { id: siteId },
        create: { id: siteId, ...data },
        update: data,
      });
      return previous;
    });
    return attachHumanAuditEvent(
      { ...policy },
      {
        title: 'تنظیمات بازیابی سبد به‌روزرسانی شد.',
        entityName: 'بازیابی سبد',
        operationType: 'UPDATE',
        changes: [
          {
            field: 'remindersEnabled',
            label: 'نمایش یادآوری',
            before: previous.remindersEnabled,
            after: policy.remindersEnabled,
          },
          {
            field: 'idleHours',
            label: 'ساعت بی‌فعالیتی',
            before: previous.idleHours,
            after: policy.idleHours,
          },
          {
            field: 'retentionDays',
            label: 'روز نگهداری',
            before: previous.retentionDays,
            after: policy.retentionDays,
          },
        ],
      },
    );
  }
}
