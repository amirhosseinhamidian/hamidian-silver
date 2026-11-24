import { ConflictException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { MIN_WALLET_CASH_PAYMENT_TOMAN, TOMAN_INT_MAX } from '../../common/toman';
import type { Prisma } from '../../generated/prisma/client';
import { DomainException } from '../../common/errors/domain-exception';
import { ErrorCode } from '../../common/errors/error-codes';
import type { PromotionLine } from '../promotions/promotion-engine';
import {
  calculateRedemption,
  calculateRewardPolicy,
} from '../reward-policies/reward-policy-engine';
import { RewardPoliciesService } from '../reward-policies/reward-policies.service';
import {
  allocateCheckoutDiscount,
  allocateCheckoutToman,
  returnedLineCredit,
  type CheckoutPromotion,
} from './wallet-checkout';
import { WalletLedgerService } from './wallet-ledger.service';

type WalletOrder = { id: string; userId: string; walletAppliedToman: number };

export const openWalletAttemptStatuses = [
  'CREATED',
  'REDIRECTED',
  'AWAITING_REVIEW',
  'RECONCILIATION_REQUIRED',
] as const;

@Injectable()
export class WalletCheckoutService {
  constructor(
    private readonly policies: RewardPoliciesService,
    private readonly ledger: WalletLedgerService,
  ) {}

  async quote(
    tx: Prisma.TransactionClient,
    userId: string,
    lines: readonly PromotionLine[],
    payableBeforeWalletToman: number,
    promotion?: CheckoutPromotion | null,
  ) {
    const cashCap = payableBeforeWalletToman - MIN_WALLET_CASH_PAYMENT_TOMAN;
    if (cashCap <= 0) return null;

    const now = new Date();
    const { policy } = await this.policies.active(now, tx);
    if (!policy?.enabled) return null;

    const balance = await tx.walletLot.aggregate({
      where: { userId, expiresAt: { gt: now }, availableToman: { gt: 0 } },
      _sum: { availableToman: true },
    });
    const availableToman = Math.min(balance._sum.availableToman ?? 0, TOMAN_INT_MAX);
    if (!availableToman) return null;

    const merchandise = lines.map((line) => line.unitSalePriceToman * line.quantity);
    const discounts = allocateCheckoutDiscount(lines, promotion);
    const redemption = calculateRedemption(
      policy.definition,
      lines.map(({ productId, categoryIds }, index) => ({
        productId,
        categoryIds: [...categoryIds],
        merchandiseToman: merchandise[index],
        directDiscountToman: discounts[index],
      })),
      promotion?.rule.coupon ?? false,
      availableToman,
      cashCap,
    );
    if (!redemption.maximumToman) return null;

    return {
      policyVersion: policy.version,
      bandCode: redemption.bandCode,
      amountToman: redemption.maximumToman,
      lineAmounts: allocateCheckoutToman(redemption.maximumToman, redemption.weights),
    };
  }

  async reserve(tx: Prisma.TransactionClient, order: WalletOrder, key: string) {
    if (!order.walletAppliedToman) return;
    try {
      await this.ledger.reserve(
        {
          userId: order.userId,
          orderId: order.id,
          amountToman: order.walletAppliedToman,
          idempotencyKey: key,
        },
        tx,
      );
    } catch (error) {
      if (!(error instanceof ConflictException)) throw error;
      throw new DomainException(
        ErrorCode.WALLET_CREDIT_UNAVAILABLE,
        'اعتبار لازم برای این سفارش در دسترس نیست. مبلغ سفارش را دوباره بررسی کنید.',
      );
    }
  }

  // Payment callers hold the order row lock until the attempt and its funding both commit.
  async reacquire(tx: Prisma.TransactionClient, order: WalletOrder) {
    if (!order.walletAppliedToman) return;
    const active = await this.reservation(tx, order, 'RESERVED');
    if (active) return;
    await this.reserve(tx, order, `checkout:retry:${order.id}:${randomUUID()}`);
  }

  async capture(tx: Prisma.TransactionClient, order: WalletOrder) {
    if (!order.walletAppliedToman) return;
    const reserved = await this.reservation(tx, order, 'RESERVED');
    if (!reserved)
      throw new ConflictException('Wallet credit is no longer reserved for this order.');
    await this.ledger.capture(
      {
        userId: order.userId,
        reservationId: reserved.id,
        idempotencyKey: `checkout:capture:${reserved.id}`,
      },
      tx,
    );
  }

  async hasOpenPayment(tx: Prisma.TransactionClient, orderId: string) {
    return Boolean(
      await tx.paymentAttempt.findFirst({
        where: { payment: { orderId }, status: { in: [...openWalletAttemptStatuses] } },
        select: { id: true },
      }),
    );
  }

  async releaseAfterFailure(tx: Prisma.TransactionClient, order: WalletOrder) {
    if (order.walletAppliedToman && !(await this.hasOpenPayment(tx, order.id))) {
      await this.release(tx, order);
    }
  }

  async release(tx: Prisma.TransactionClient, order: WalletOrder) {
    if (!order.walletAppliedToman) return;
    const reserved = await this.reservation(tx, order, 'RESERVED');
    if (!reserved) return;
    await this.ledger.release(
      {
        userId: order.userId,
        reservationId: reserved.id,
        idempotencyKey: `checkout:release:${reserved.id}`,
      },
      tx,
    );
  }

  async restore(
    tx: Prisma.TransactionClient,
    order: WalletOrder,
    requestedToman: number,
    key: string,
  ) {
    if (!order.walletAppliedToman || !requestedToman) return;
    const capture = await this.reservation(tx, order, 'CAPTURED');
    if (!capture) throw new ConflictException('The original wallet capture could not be found.');

    await this.ledger.lockAccount(tx, order.userId);
    const priorOperation = await tx.walletOperation.findUnique({
      where: { userId_idempotencyKey: { userId: order.userId, idempotencyKey: key } },
      select: { id: true },
    });
    if (priorOperation) return;
    const previous = await tx.walletLedgerEntry.aggregate({
      where: { reservationId: capture.id, fromBucket: 'CAPTURED' },
      _sum: { amountToman: true },
    });
    const amountToman = Math.min(
      requestedToman,
      order.walletAppliedToman - (previous._sum.amountToman ?? 0),
    );
    if (amountToman <= 0) return;
    await this.ledger.reverseCapture(
      {
        userId: order.userId,
        reservationId: capture.id,
        amountToman,
        idempotencyKey: key,
      },
      tx,
    );
  }

  async adjustPurchaseReward(
    tx: Prisma.TransactionClient,
    order: WalletOrder,
    key: string,
    fullyRefunded: boolean,
  ) {
    const where = { orderId: order.id, userId: order.userId, source: 'PURCHASE' as const };
    if (!(await tx.walletLot.findFirst({ where, select: { id: true } }))) return;
    await this.ledger.lockAccount(tx, order.userId);
    const lot = await tx.walletLot.findFirst({ where });
    if (!lot || lot.expiresAt <= new Date()) return;
    const remaining = fullyRefunded
      ? 0
      : await this.remainingPurchaseReward(tx, order, lot.policyVersion);
    const amountToman = Math.min(
      lot.pendingToman + lot.availableToman,
      lot.grantedToman - lot.revokedToman - remaining,
    );
    if (amountToman <= 0) return;
    await this.ledger.revokeGrant(
      { userId: order.userId, lotId: lot.id, amountToman, idempotencyKey: key },
      tx,
    );
  }

  private async remainingPurchaseReward(
    tx: Prisma.TransactionClient,
    order: WalletOrder,
    version: number,
  ) {
    const recorded = await tx.order.findUniqueOrThrow({
      where: { id: order.id },
      select: {
        paidAt: true,
        discountTotalToman: true,
        priceQuote: { select: { snapshot: true } },
        items: {
          orderBy: { id: 'asc' },
          select: {
            returnedQuantity: true,
            quantity: true,
            unitSalePriceToman: true,
            walletAppliedToman: true,
            variantId: true,
            platingType: true,
            variant: {
              select: {
                productId: true,
                product: { select: { categories: { select: { categoryId: true } } } },
              },
            },
          },
        },
      },
    });
    if (!recorded.paidAt) return 0;
    const { definition } = await this.policies.read(version, tx);
    const previousCompletedPurchases = await tx.order.count({
      where: {
        userId: order.userId,
        OR: [
          { paidAt: { lt: recorded.paidAt } },
          { paidAt: recorded.paidAt, id: { lt: order.id } },
        ],
      },
    });
    // WL-04 can pass immutable earning inputs once the award job is available.
    const quote = recorded.priceQuote?.snapshot as
      | {
          rule?: {
            coupon?: boolean;
            eligibleProductIds?: string[];
            kind?: string;
            bundleProductIds?: string[];
          } | null;
          items?: {
            variantId: string;
            platingType: string | null;
            productId?: string;
            categoryIds?: string[];
            directDiscountToman?: number;
          }[];
        }
      | null
      | undefined;
    const snapshotItems = new Map(
      quote?.items?.map((line) => [`${line.variantId}:${line.platingType}`, line]),
    );
    const gross = recorded.items.map((item) => item.unitSalePriceToman * item.quantity);
    const discountWeights = gross.map((amount, i) => {
      const productId = recorded.items[i].variant.productId;
      return (!quote?.rule?.eligibleProductIds ||
        quote.rule.eligibleProductIds.includes(productId)) &&
        (quote?.rule?.kind !== 'BUNDLE' || quote.rule.bundleProductIds?.includes(productId))
        ? amount
        : 0;
    });
    const discounts = allocateCheckoutToman(recorded.discountTotalToman, discountWeights);
    const lines = recorded.items.map((item, index) => {
      const snapshot = snapshotItems.get(`${item.variantId}:${item.platingType}`);
      const cash =
        gross[index] -
        (snapshot?.directDiscountToman ?? discounts[index]) -
        item.walletAppliedToman;
      return {
        productId: snapshot?.productId ?? item.variant.productId,
        categoryIds:
          snapshot?.categoryIds ??
          item.variant.product.categories.map(({ categoryId }) => categoryId),
        merchandiseToman: cash - returnedLineCredit(cash, item.quantity, 0, item.returnedQuantity),
        directDiscountToman: 0,
        settledCreditToman: 0,
        refundedCashToman: 0,
      };
    });
    return calculateRewardPolicy(version, definition, {
      outcome: 'PAID',
      previousCompletedPurchases,
      lines,
      couponApplied: quote?.rule?.coupon ?? false,
      availableCreditToman: 0,
      shippingDiscountToman: 0,
      otherOrderIncentivesToman: 0,
      usage: {
        customerRewardsToman: 0,
        periodRewardsToman: 0,
        customerIncentivesToman: 0,
        periodIncentivesToman: 0,
      },
    }).estimatedRewardToman;
  }

  private async reservation(
    tx: Prisma.TransactionClient,
    order: WalletOrder,
    status: 'RESERVED' | 'CAPTURED',
  ) {
    const row = await tx.walletReservation.findFirst({
      where: { orderId: order.id, userId: order.userId, status },
      select: { id: true, amountToman: true },
    });
    if (row && row.amountToman !== order.walletAppliedToman) {
      throw new ConflictException('The wallet reservation and order snapshot do not match.');
    }
    return row;
  }
}
