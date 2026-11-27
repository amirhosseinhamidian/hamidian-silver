export const referralRiskPath = '/reward-policies/referral-risk';
export const riskLabels = {
  SELF_REFERRAL: 'معرفی خود',
  SHARED_DEVICE: 'شناسهٔ مرورگر مشترک',
  SHARED_NETWORK: 'شبکهٔ مشترک',
  SHARED_ADDRESS: 'نشانی مشابه',
  SHARED_RECIPIENT: 'نام گیرندهٔ مشابه',
  VERIFIED_PAYMENT_REUSE: 'تکرار شناسهٔ پرداخت تأییدشده',
  REFERRAL_FREQUENCY: 'تعداد معرفی‌ها',
  CANCELLED_ORDERS: 'تعداد سفارش لغوشده',
  FAST_PAYMENT: 'فاصلهٔ کوتاه ثبت معرفی تا پرداخت (ثانیه)',
};
export const actionLabels = {
  ALLOW: 'مجاز',
  REVIEW: 'نیازمند بررسی',
  HOLD: 'پاداش معلق',
  REJECT: 'رد پاداش',
};
export const confidenceLabels = { LOW: 'کم', MEDIUM: 'متوسط', HIGH: 'زیاد' };
export type RiskCode = keyof typeof riskLabels;
export type RiskAction = keyof typeof actionLabels;
export type RiskEvidence = { code: RiskCode; value: number; weight: number };
export type RiskSignal = {
  code: RiskCode;
  enabled: boolean;
  windowDays: number;
  weight: number;
  threshold: number;
};
export type RiskException = {
  attributionId: string;
  codes: RiskCode[];
  until: string;
  reason: string;
};
export type RiskDefinition = {
  minSignals: number;
  reviewAt: number;
  holdAt: number;
  rejectAt: number;
  reviewHours: number;
  retentionDays: number;
  signals: RiskSignal[];
  exceptions: RiskException[];
};
export type RiskPolicy = {
  version: number | null;
  definition: RiskDefinition;
  publishedAt: string | null;
  publishedById: string | null;
};
export type RiskPolicyOverview = { active: RiskPolicy; history: RiskPolicy[]; hasMore: boolean };
export type RiskPreview = {
  score: number;
  action: RiskAction;
  confidence: keyof typeof confidenceLabels;
  evidence: RiskEvidence[];
};
export type RiskCase = Omit<RiskPreview, 'evidence'> & {
  attributionId: string;
  orderId: string;
  policyVersion: number | null;
  autoAction: RiskAction;
  revision: number;
  assessedAt: string;
  dueAt: string | null;
  overdue: boolean;
  expiresAt: string;
  evidence: RiskEvidence[] | null;
  reviews: {
    revision: number;
    fromAction: RiskAction;
    action: RiskAction;
    reason: string;
    actorUserId: string;
    recordedAt: string;
  }[];
};
export type RiskQueue = { items: RiskCase[]; hasMore: boolean };
export const caseUuid = /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i;
export const binaryRiskSignals = new Set<RiskCode>(['SELF_REFERRAL']);
export const similarityRiskSignals = new Set<RiskCode>(['SHARED_ADDRESS', 'SHARED_RECIPIENT']);
