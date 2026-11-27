import type { components } from '@hamidian/contracts';

export type Mode = 'basket' | 'history';
export type PolicyDecision = 'RECOMMEND' | 'HOLD' | 'REJECT';

export const policyDecisions = {
  RECOMMEND: 'پیشنهاد انتشار',
  HOLD: 'نیازمند بررسی',
  REJECT: 'رد سناریو',
} satisfies Record<PolicyDecision, string>;

type BasketLine = {
  productSlug: string;
  variantSku?: string;
  quantity: number;
  defaultPriceToman: number | null;
  unitPriceToman: number;
  merchandiseDiscountToman: number;
  referralDiscountToman: number;
  walletToman: number;
};

export type PolicyBasketResult = {
  items: BasketLine[];
  merchandiseToman: number;
  merchandiseDiscountToman: number;
  shippingToman: number;
  shippingDiscountToman: number;
  referralDiscountToman: number;
  walletToman: number;
  payableToman: number;
  activationDelayDays: number;
  campaignRevision: number | null;
  promotionVersion: number | null;
  remainingCampaignBudgetToman: number | null;
  reward: components['schemas']['RewardSimulationDto'];
  referral: components['schemas']['ReferralRewardPreviewDto'] | null;
  risk: components['schemas']['ReferralRiskPreviewDto'] | null;
  resolvedRiskVersion: number | null;
  warnings: string[];
  reviewId: string | null;
};

export type PolicyHistoryResult = {
  version: number;
  pendingOnly: boolean;
  scannedOrders: number;
  evaluatedOrders: number;
  withoutEvidence: number;
  truncated: boolean;
  recordedRewardToman: number;
  estimatedRewardToman: number;
  limitedOrders: number;
  fingerprint: string;
  reviewId: string | null;
};

export type PolicyReviewList = {
  page: number;
  hasMore: boolean;
  items: Array<{
    id: string;
    mode: 'BASKET' | 'HISTORY';
    decision: PolicyDecision;
    createdAt: string;
    input: Record<string, unknown>;
    result: Record<string, unknown>;
  }>;
};

export function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function parsePolicyResult(mode: Mode, value: unknown) {
  const result = asObject(value);
  if (!result) return null;
  if (mode === 'basket') {
    if (!Array.isArray(result.items) || !asObject(result.reward) || !Array.isArray(result.warnings))
      return null;
  } else if (typeof result.fingerprint !== 'string' || typeof result.evaluatedOrders !== 'number') {
    return null;
  }
  return result as unknown as PolicyBasketResult | PolicyHistoryResult;
}
