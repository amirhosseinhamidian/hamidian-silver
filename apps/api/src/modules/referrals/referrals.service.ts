import { HttpException, HttpStatus, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import { DomainException } from '../../common/errors/domain-exception';
import { ErrorCode } from '../../common/errors/error-codes';
import type { Prisma, ReferralGrantJob } from '../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import type {
  ReceivedReferralDto,
  ReferralHistoryItemDto,
  ReferralOverviewDto,
} from './dto/referral.dto';
import { effectiveReferralRewardPolicy } from './referral-reward-policies.service';
import { findQualifyingReferralPurchase, lockReferralBuyer } from './referral-eligibility';
import { referralCheckoutAvailable } from './referral-checkout';

const dayMs = 86_400_000;
const pageSize = 20;
const historySelect = {
  id: true,
  claimedAt: true,
  expiresAt: true,
  firstOrderId: true,
  firstPaidAt: true,
  firstOrder: { select: { referralCheckoutAttributionId: true } },
} satisfies Prisma.ReferralAttributionSelect;
type Claim = Prisma.ReferralAttributionGetPayload<{ select: typeof historySelect }>;
type Identity = { isActive: boolean; deletedAt: Date | null; phoneVerifiedAt: Date | null };

function historyItem(claim: Claim, now: Date): ReferralHistoryItemDto {
  const paid = claim.firstPaidAt;
  const discountWasReserved = claim.firstOrder?.referralCheckoutAttributionId === claim.id;
  const qualifyingPayment =
    paid && paid >= claim.claimedAt && (paid < claim.expiresAt || discountWasReserved)
      ? paid
      : null;
  return {
    id: claim.id,
    claimedAt: claim.claimedAt.toISOString(),
    expiresAt: claim.expiresAt.toISOString(),
    status: qualifyingPayment
      ? 'FIRST_PURCHASE_CONFIRMED'
      : paid || now >= claim.expiresAt
        ? 'EXPIRED'
        : 'PENDING',
    firstPaidAt: qualifyingPayment?.toISOString() ?? null,
  };
}

function received(claim: Claim, now: Date): ReceivedReferralDto {
  const item = historyItem(claim, now);
  return { ...item, firstOrderId: item.firstPaidAt ? claim.firstOrderId : null };
}

function outgoingRewardStatus(
  status: ReferralHistoryItemDto['status'],
  grant: Pick<ReferralGrantJob, 'status' | 'resultCode' | 'nextAttemptAt'> | null,
): NonNullable<ReferralHistoryItemDto['rewardStatus']> {
  if (status === 'EXPIRED' || grant?.status === 'EXPIRED') return 'EXPIRED';
  if (status === 'PENDING') return 'AWAITING_PURCHASE';
  if (grant?.status === 'REJECTED') return 'INELIGIBLE';
  if (grant?.status === 'APPROVED' && !grant.nextAttemptAt) return 'ISSUED';
  if (grant?.resultCode === 'RISK_PENDING' || grant?.status === 'APPROVED') return 'IN_REVIEW';
  return 'PENDING';
}

@Injectable()
export class ReferralsService {
  constructor(
    private readonly db: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private enabled() {
    return this.config.get<boolean>('REFERRALS_ENABLED', false) === true;
  }

  private policy() {
    return {
      version: 1,
      attributionDays: this.config.get<number>('REFERRAL_ATTRIBUTION_DAYS', 30),
      requireVerifiedPhone: this.config.get<boolean>('REFERRAL_REQUIRE_VERIFIED_PHONE', true),
      maxAccountAgeDays: this.config.get<number>('REFERRAL_MAX_ACCOUNT_AGE_DAYS', 0),
      conflictRule: 'FIRST_ACCEPTED',
    };
  }

  async checkout(userId: string) {
    return { available: this.enabled() && (await referralCheckoutAvailable(this.db, userId)) };
  }

  async overview(userId: string, page: number): Promise<ReferralOverviewDto> {
    const now = new Date();
    const [code, incoming, outgoing, purchase] = await Promise.all([
      this.db.referralCode.findUnique({ where: { userId }, select: { code: true } }),
      this.db.referralAttribution.findUnique({
        where: { referredUserId: userId },
        select: historySelect,
      }),
      this.db.referralAttribution.findMany({
        where: { referrerUserId: userId },
        orderBy: [{ claimedAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize + 1,
        select: {
          ...historySelect,
          grantJob: { select: { status: true, resultCode: true, nextAttemptAt: true } },
        },
      }),
      findQualifyingReferralPurchase(this.db, userId, now),
    ]);
    return {
      enabled: this.enabled(),
      attributionDays: this.policy().attributionDays,
      referrerEligible: Boolean(purchase),
      code: purchase ? (code?.code ?? null) : null,
      incoming: incoming ? received(incoming, now) : null,
      outgoing: {
        items: outgoing.slice(0, pageSize).map((claim) => {
          const item = historyItem(claim, now);
          return { ...item, rewardStatus: outgoingRewardStatus(item.status, claim.grantJob) };
        }),
        page,
        hasMore: outgoing.length > pageSize,
      },
    };
  }

  async issueCode(userId: string) {
    await this.checkWriteLimit(userId);
    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: { isActive: true, deletedAt: true, phoneVerifiedAt: true },
    });
    this.requireIdentity(user, this.policy().requireVerifiedPhone);
    if (!(await findQualifyingReferralPurchase(this.db, userId, new Date()))) {
      throw new DomainException(ErrorCode.REFERRAL_REFERRER_PURCHASE_REQUIRED);
    }

    const existing = await this.db.referralCode.findUnique({
      where: { userId },
      select: { code: true },
    });
    if (existing) return existing;
    await this.db.referralCode.createMany({
      data: { userId, code: randomBytes(18).toString('base64url') },
      skipDuplicates: true,
    });
    const issued = await this.db.referralCode.findUnique({
      where: { userId },
      select: { code: true },
    });
    if (!issued)
      throw new ServiceUnavailableException('Could not issue a referral code. Retry the request.');
    return issued;
  }

  async claim(userId: string, code: string): Promise<ReceivedReferralDto> {
    await this.checkWriteLimit(userId);
    return this.db.$transaction(async (tx) => {
      // Match the lock used by the order payment outbox and the referral payment trigger.
      await lockReferralBuyer(tx, userId);
      const [{ now }] = await tx.$queryRaw<Array<{ now: Date }>>`
        SELECT clock_timestamp()::timestamptz(3) AS now
      `;
      const policy = this.policy();
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { isActive: true, deletedAt: true, phoneVerifiedAt: true, createdAt: true },
      });
      const identity = this.requireIdentity(user, policy.requireVerifiedPhone);
      const inviter = await tx.referralCode.findUnique({
        where: { code },
        select: {
          userId: true,
          user: { select: { isActive: true, deletedAt: true, phoneVerifiedAt: true } },
        },
      });
      if (
        !inviter ||
        !inviter.user.isActive ||
        inviter.user.deletedAt ||
        (policy.requireVerifiedPhone && !inviter.user.phoneVerifiedAt)
      ) {
        throw new DomainException(ErrorCode.REFERRAL_INVALID_CODE);
      }
      if (inviter.userId === userId) throw new DomainException(ErrorCode.REFERRAL_SELF);

      const existing = await tx.referralAttribution.findUnique({
        where: { referredUserId: userId },
        select: { ...historySelect, referrerUserId: true },
      });
      if (existing) {
        if (existing.referrerUserId !== inviter.userId) {
          throw new DomainException(ErrorCode.REFERRAL_ALREADY_CLAIMED);
        }
        return received(existing, now);
      }
      const referrerPurchase = await findQualifyingReferralPurchase(tx, inviter.userId, now);
      if (!referrerPurchase) {
        throw new DomainException(ErrorCode.REFERRAL_REFERRER_PURCHASE_REQUIRED);
      }
      if (
        policy.maxAccountAgeDays &&
        +now - +identity.createdAt > policy.maxAccountAgeDays * dayMs
      ) {
        throw new DomainException(ErrorCode.REFERRAL_ACCOUNT_INELIGIBLE);
      }

      const purchased = await tx.order.findFirst({
        where: {
          userId,
          paidAt: { not: null },
          payment: { status: { in: ['PAID', 'PARTIALLY_REFUNDED', 'REFUNDED'] } },
        },
        select: { id: true },
      });
      if (purchased) throw new DomainException(ErrorCode.REFERRAL_FIRST_PURCHASE_EXISTS);

      const rewardPolicy = await tx.referralRewardPolicyVersion.findFirst({
        ...effectiveReferralRewardPolicy(now),
        select: { version: true },
      });
      const attribution = await tx.referralAttribution.create({
        data: {
          referredUserId: userId,
          referrerUserId: inviter.userId,
          referrerPurchaseOrderId: referrerPurchase.id,
          policySnapshot: policy,
          rewardPolicyVersion: rewardPolicy?.version ?? null,
          claimedAt: now,
          expiresAt: new Date(+now + policy.attributionDays * dayMs),
        },
        select: historySelect,
      });
      return received(attribution, now);
    });
  }

  private requireIdentity<T extends Identity>(user: T | null, requireVerifiedPhone: boolean): T {
    if (!user || !user.isActive || user.deletedAt) {
      throw new DomainException(ErrorCode.REFERRAL_ACCOUNT_INELIGIBLE);
    }
    if (requireVerifiedPhone && !user.phoneVerifiedAt) {
      throw new DomainException(ErrorCode.REFERRAL_VERIFICATION_REQUIRED);
    }
    return user;
  }

  private async checkWriteLimit(userId: string) {
    if (!this.enabled()) throw new DomainException(ErrorCode.REFERRAL_DISABLED);
    const [allowed] = await this.db.$queryRaw<Array<{ attempts: number }>>`
      INSERT INTO "referral_request_limits" ("userId", "windowStartAt", "attempts")
      VALUES (${userId}::uuid, statement_timestamp(), 1)
      ON CONFLICT ("userId") DO UPDATE SET
        "windowStartAt" = CASE WHEN "referral_request_limits"."windowStartAt" <=
          EXCLUDED."windowStartAt" - INTERVAL '15 minutes'
          THEN EXCLUDED."windowStartAt" ELSE "referral_request_limits"."windowStartAt" END,
        "attempts" = CASE WHEN "referral_request_limits"."windowStartAt" <=
          EXCLUDED."windowStartAt" - INTERVAL '15 minutes'
          THEN 1 ELSE "referral_request_limits"."attempts" + 1 END
      WHERE "referral_request_limits"."attempts" < 10 OR
        "referral_request_limits"."windowStartAt" <= EXCLUDED."windowStartAt" - INTERVAL '15 minutes'
      RETURNING "attempts"
    `;
    if (!allowed) {
      throw new HttpException(
        'Too many referral requests. Try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }
}
