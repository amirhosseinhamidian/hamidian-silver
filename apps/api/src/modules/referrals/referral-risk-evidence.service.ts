import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import type { ReferralRiskPolicyDto, RiskCode } from './dto/referral-risk.dto';
import type { RiskMetrics } from './referral-risk-engine';

const day = 86_400_000;
const addressSelect = {
  recipientName: true,
  province: true,
  city: true,
  addressLine: true,
  postalCode: true,
} as const;
type Address = Record<keyof typeof addressSelect, string>;
type Candidate = {
  id: string;
  referrerUserId: string;
  referredUserId: string;
  firstOrderId: string;
  claimedAt: Date;
  firstPaidAt: Date;
};

function normalize(value: string) {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[۰-۹٠-٩]/g, (digit) => String(digit.charCodeAt(0) & 15))
    .replace(/[^\p{L}\p{N}]/gu, '');
}

function addressKey(address: Address) {
  return [address.province, address.city, address.addressLine, address.postalCode]
    .map(normalize)
    .join('|');
}

function similarity(left: string, right: string) {
  if (!left || !right) return 0;
  if (left === right) return 100;
  if (left.length < 2 || right.length < 2) return 0;
  const pairs = new Map<string, number>();
  for (let index = 0; index < left.length - 1; index += 1) {
    const pair = left.slice(index, index + 2);
    pairs.set(pair, (pairs.get(pair) ?? 0) + 1);
  }
  let matches = 0;
  for (let index = 0; index < right.length - 1; index += 1) {
    const pair = right.slice(index, index + 2);
    const count = pairs.get(pair) ?? 0;
    if (count > 0) {
      matches += 1;
      pairs.set(pair, count - 1);
    }
  }
  return Math.floor((200 * matches) / (left.length + right.length - 2));
}

@Injectable()
export class ReferralRiskEvidenceService {
  constructor(private readonly db: PrismaService) {}

  async collect(claim: Candidate, policy: ReferralRiskPolicyDto, now: Date): Promise<RiskMetrics> {
    const enabled = new Map(
      policy.signals
        .filter((signal) => signal.enabled)
        .map((signal) => [signal.code, signal.windowDays]),
    );
    const since = (code: RiskCode) => new Date(+now - (enabled.get(code) ?? 0) * day);
    const [right, addresses, paymentReuse, frequency, cancellations] = await Promise.all([
      enabled.has('SHARED_DEVICE') || enabled.has('SHARED_NETWORK')
        ? this.db.referralRiskObservation.findUnique({
            where: { userId: claim.referredUserId },
          })
        : null,
      enabled.has('SHARED_ADDRESS') || enabled.has('SHARED_RECIPIENT')
        ? this.addresses(
            claim,
            new Date(Math.min(+since('SHARED_ADDRESS'), +since('SHARED_RECIPIENT'))),
            now,
          )
        : null,
      enabled.has('VERIFIED_PAYMENT_REUSE')
        ? this.paymentReuse(claim, since('VERIFIED_PAYMENT_REUSE'), now)
        : undefined,
      enabled.has('REFERRAL_FREQUENCY')
        ? this.db.referralAttribution.count({
            where: {
              referrerUserId: claim.referrerUserId,
              claimedAt: { gte: since('REFERRAL_FREQUENCY'), lte: now },
            },
          })
        : undefined,
      enabled.has('CANCELLED_ORDERS')
        ? this.db.order.count({
            where: {
              userId: claim.referredUserId,
              status: 'CANCELLED',
              cancelledAt: { gte: since('CANCELLED_ORDERS'), lte: now },
            },
          })
        : undefined,
    ]);

    const matchingHash = (
      code: 'SHARED_NETWORK' | 'SHARED_DEVICE',
      field: 'deviceHash' | 'networkHash',
    ) => {
      const hash = right?.[field];
      if (
        !right ||
        !enabled.has(code) ||
        !hash ||
        right.recordedAt < since(code) ||
        right.recordedAt > now
      )
        return undefined;
      return this.db.referralRiskObservation.count({
        where: {
          [field]: hash,
          userId: { not: claim.referredUserId },
          recordedAt: { gte: since(code), lte: now },
        },
      });
    };
    const [deviceMatches, networkMatches] = await Promise.all([
      matchingHash('SHARED_DEVICE', 'deviceHash'),
      matchingHash('SHARED_NETWORK', 'networkHash'),
    ]);
    const matchingAddress = (
      code: 'SHARED_ADDRESS' | 'SHARED_RECIPIENT',
      key: (address: Address) => string,
    ) => {
      if (!addresses || claim.firstPaidAt < since(code)) return undefined;
      const needle = key(addresses.buyer);
      return addresses.comparisons.reduce(
        (score, { value, at }) =>
          at >= since(code) ? Math.max(score, similarity(needle, key(value))) : score,
        0,
      );
    };
    return {
      SELF_REFERRAL:
        claim.claimedAt >= since('SELF_REFERRAL')
          ? Number(claim.referrerUserId === claim.referredUserId)
          : undefined,
      SHARED_DEVICE: deviceMatches,
      SHARED_NETWORK: networkMatches,
      SHARED_ADDRESS: matchingAddress('SHARED_ADDRESS', addressKey),
      SHARED_RECIPIENT: matchingAddress('SHARED_RECIPIENT', (value) =>
        normalize(value.recipientName),
      ),
      VERIFIED_PAYMENT_REUSE: paymentReuse,
      REFERRAL_FREQUENCY: frequency,
      CANCELLED_ORDERS: cancellations,
      FAST_PAYMENT:
        claim.firstPaidAt >= since('FAST_PAYMENT')
          ? Math.floor((+claim.firstPaidAt - +claim.claimedAt) / 1_000)
          : undefined,
    };
  }

  private async addresses(claim: Candidate, from: Date, now: Date) {
    const [buyer, previous] = await Promise.all([
      this.db.orderAddress.findUnique({
        where: { orderId: claim.firstOrderId },
        select: addressSelect,
      }),
      this.db.order.findMany({
        where: {
          userId: claim.referrerUserId,
          paidAt: { gte: from, lte: now },
          shippingAddress: { isNot: null },
        },
        orderBy: [{ paidAt: 'desc' }, { id: 'desc' }],
        take: 25,
        select: { paidAt: true, shippingAddress: { select: addressSelect } },
      }),
    ]);
    if (!buyer) return null;
    return {
      buyer,
      comparisons: previous.flatMap(({ paidAt, shippingAddress }) =>
        paidAt && shippingAddress ? [{ at: paidAt, value: shippingAddress }] : [],
      ),
    };
  }

  private async paymentReuse(claim: Candidate, from: Date, now: Date) {
    const payment = await this.db.paymentAttempt.findFirst({
      where: {
        payment: { orderId: claim.firstOrderId },
        status: 'VERIFIED',
        provider: { not: 'card_to_card' },
        providerReference: { not: null },
        verifiedAt: { gte: from, lte: now },
      },
      orderBy: [{ verifiedAt: 'desc' }, { id: 'desc' }],
      select: { provider: true, providerReference: true },
    });
    if (!payment?.providerReference) return undefined;
    return this.db.paymentAttempt.count({
      where: {
        ...payment,
        status: 'VERIFIED',
        verifiedAt: { gte: from, lte: now },
        payment: { order: { userId: { not: claim.referredUserId } } },
      },
    });
  }
}
