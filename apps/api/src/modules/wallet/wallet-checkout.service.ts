import { ConflictException, Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { MIN_WALLET_CASH_PAYMENT_TOMAN, TOMAN_INT_MAX } from '../../common/toman';
import type { Prisma } from '../../generated/prisma/client';
import { DomainException } from '../../common/errors/domain-exception';
import { ErrorCode } from '../../common/errors/error-codes';
import type { PromotionLine } from '../promotions/promotion-engine';
import { calculateRedemption } from '../reward-policies/reward-policy-engine';
import { RewardPoliciesService } from '../reward-policies/reward-policies.service';
import {
  allocateCheckoutDiscount,
  allocateCheckoutToman,
  type CheckoutPromotion,
} from './wallet-checkout';
import { spendableWalletLots } from './wallet-ledger';
import { WalletLedgerService } from './wallet-ledger.service';
import { purchaseRewardOrderSelect, resolvePurchaseRewardBasis } from './purchase-reward-basis';
import { evaluatePurchaseReward, type RecordedPurchaseReward } from './purchase-reward-calculation';
import type { WalletPreviewDto } from './dto/customer-wallet.dto';

type WalletOrder = { id: string; userId: string; walletAppliedToman: number };
type WalletAllocation = {
  policyVersion: number;
  bandCode: string | null;
  amountToman: number;
  lineAmounts: number[];
};
type WalletQuote = {
  allocation: WalletAllocation | null;
  reason: WalletPreviewDto['walletUnavailableReason'];
};

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
    @Optional() private readonly config?: ConfigService,
  ) {}

  async quote(
    tx: Prisma.TransactionClient,
    userId: string,
    lines: readonly PromotionLine[],
    payableBeforeWalletToman: number,
    promotion?: CheckoutPromotion | null,
    appliedDiscounts?: readonly number[],
  ): Promise<WalletQuote> {
    if (this.config?.get<boolean>('WALLET_CHECKOUT_ENABLED') === false)
      return { allocation: null, reason: 'POLICY_DISABLED' };
    const cashCap = payableBeforeWalletToman - MIN_WALLET_CASH_PAYMENT_TOMAN;
    if (cashCap <= 0) return { allocation: null, reason: 'MINIMUM_CASH' };

    const now = new Date();
    const { policy } = await this.policies.active(now, tx);
    if (!policy?.enabled) return { allocation: null, reason: 'POLICY_DISABLED' };

    const balance = await tx.walletLot.aggregate({
      where: { ...spendableWalletLots(userId, now), availableToman: { gt: 0 } },
      _sum: { availableToman: true },
    });
    const availableToman = Math.min(balance._sum.availableToman ?? 0, TOMAN_INT_MAX);
    if (!availableToman) return { allocation: null, reason: 'NO_AVAILABLE_CREDIT' };

    const couponApplied = promotion?.rule.coupon ?? false;
    if (couponApplied && !policy.definition.redemptionEligibility.allowCoupon) {
      return { allocation: null, reason: 'COUPON_EXCLUDED' };
    }

    const merchandise = lines.map((line) => line.unitSalePriceToman * line.quantity);
    const discounts = appliedDiscounts ?? allocateCheckoutDiscount(lines, promotion);
    const redemption = calculateRedemption(
      policy.definition,
      lines.map(({ productId, categoryIds }, index) => ({
        productId,
        categoryIds: [...categoryIds],
        merchandiseToman: merchandise[index],
        directDiscountToman: discounts[index],
      })),
      couponApplied,
      availableToman,
      cashCap,
    );
    if (!redemption.maximumToman) {
      return {
        allocation: null,
        reason: redemption.redemptionBaseToman ? 'POLICY_LIMIT' : 'NO_ELIGIBLE_ITEMS',
      };
    }

    return {
      allocation: {
        policyVersion: policy.version,
        bandCode: redemption.bandCode,
        amountToman: redemption.maximumToman,
        lineAmounts: allocateCheckoutToman(redemption.maximumToman, redemption.weights),
      },
      reason: null,
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
    order: Pick<WalletOrder, 'id' | 'userId'>,
    key: string,
    fullyRefunded: boolean,
  ) {
    const where = { orderId: order.id, userId: order.userId, source: 'PURCHASE' as const };
    if (!(await tx.walletLot.findFirst({ where, select: { id: true } }))) return;
    await this.ledger.lockAccount(tx, order.userId);
    const lot = await tx.walletLot.findFirst({ where });
    if (!lot || lot.policyVersion === null || lot.expiresAt <= new Date()) return;
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
    order: Pick<WalletOrder, 'id' | 'userId'>,
    version: number,
  ) {
    const recordedOrder = await tx.order.findUniqueOrThrow({
      where: { id: order.id },
      select: purchaseRewardOrderSelect,
    });
    if (!recordedOrder.paidAt) return 0;
    const { definition } = await this.policies.read(version, tx);
    const job = await tx.purchaseRewardJob.findUnique({
      where: { orderId: order.id },
      select: { calculation: true, policyVersion: true },
    });
    if (job?.calculation && job.policyVersion === version) {
      const applied = evaluatePurchaseReward(
        version,
        definition,
        recordedOrder,
        job.calculation as unknown as RecordedPurchaseReward,
      );
      return applied.estimatedRewardToman;
    }

    const previousCompletedPurchases = await tx.order.count({
      where: {
        userId: order.userId,
        OR: [
          { paidAt: { lt: recordedOrder.paidAt } },
          { paidAt: recordedOrder.paidAt, id: { lt: order.id } },
        ],
      },
    });
    return evaluatePurchaseReward(version, definition, recordedOrder, {
      basis: resolvePurchaseRewardBasis(recordedOrder),
      previousCompletedPurchases,
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
