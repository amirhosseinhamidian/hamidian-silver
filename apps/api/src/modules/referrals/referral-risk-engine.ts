import {
  riskCodes,
  type ReferralRiskPolicyDto,
  type RiskAction,
  type RiskCode,
  type RiskConfidence,
} from './dto/referral-risk.dto';

const defaults = {
  SELF_REFERRAL: [1, 100],
  SHARED_DEVICE: [1, 25],
  SHARED_NETWORK: [1, 10],
  SHARED_ADDRESS: [95, 10],
  SHARED_RECIPIENT: [95, 10],
  VERIFIED_PAYMENT_REUSE: [1, 60],
  REFERRAL_FREQUENCY: [8, 20],
  CANCELLED_ORDERS: [3, 20],
  FAST_PAYMENT: [90, 10],
} satisfies Record<RiskCode, [number, number]>;

const strong = new Set<RiskCode>(['SELF_REFERRAL', 'VERIFIED_PAYMENT_REUSE']);
const sharedHousehold = new Set<RiskCode>(['SHARED_NETWORK', 'SHARED_ADDRESS', 'SHARED_RECIPIENT']);
export type RiskMetrics = Partial<Record<RiskCode, number>>;

export function defaultReferralRiskPolicy(): ReferralRiskPolicyDto {
  return {
    minSignals: 2,
    reviewAt: 25,
    holdAt: 45,
    rejectAt: 70,
    reviewHours: 48,
    retentionDays: 30,
    signals: riskCodes.map((code) => ({
      code,
      enabled: true,
      weight: defaults[code][1],
      threshold: defaults[code][0],
      windowDays: 30,
    })),
    exceptions: [],
  };
}

export function assessReferralRisk(
  policy: ReferralRiskPolicyDto,
  metrics: RiskMetrics,
  attributionId: string,
  now: Date,
) {
  const excluded = new Set(
    policy.exceptions
      .filter(
        (entry) =>
          entry.attributionId.toLowerCase() === attributionId.toLowerCase() &&
          Date.parse(entry.until) > +now,
      )
      .flatMap(({ codes }) => codes),
  );
  const matches = policy.signals.flatMap(({ code, weight, threshold, enabled }) => {
    const value = metrics[code];
    if (!enabled || excluded.has(code) || value === undefined) return [];
    const matched = code === 'FAST_PAYMENT' ? value <= threshold : value >= threshold;
    return matched ? [{ code, weight, value }] : [];
  });
  const score = matches.reduce((total, { weight }) => total + weight, 0);
  const hasStrong = matches.some(({ code }) => strong.has(code));
  const confidence: RiskConfidence =
    hasStrong && matches.length >= 2 ? 'HIGH' : hasStrong || matches.length >= 2 ? 'MEDIUM' : 'LOW';
  let action: RiskAction = 'ALLOW';
  if (matches.length >= policy.minSignals && score >= policy.reviewAt) {
    const householdOnly = matches.every(({ code }) => sharedHousehold.has(code));
    if (householdOnly) {
      action = matches.length > 1 ? 'REVIEW' : 'ALLOW';
    } else if (score >= policy.rejectAt && hasStrong) {
      action = 'REJECT';
    } else {
      action = score >= policy.holdAt ? 'HOLD' : 'REVIEW';
    }
  }
  return { score, confidence, action, evidence: matches };
}
