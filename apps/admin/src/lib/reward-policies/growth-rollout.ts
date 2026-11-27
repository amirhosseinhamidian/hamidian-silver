export const issuanceLabels = {
  SHADOW: 'شبیه‌سازی بدون صدور',
  PAUSED: 'توقف صدور',
  LIVE: 'صدور فعال',
} as const;

export type IssuanceMode = keyof typeof issuanceLabels;
export type IssuanceState = { mode: IssuanceMode; version: number; changedAt: string };

export const apiFlagLabels = {
  campaignPromotionsEnabled: 'تخفیف و جایگاه‌های عمومی کمپین',
  walletCheckoutEnabled: 'مصرف کیف پول در سفارش جدید',
  referralsEnabled: 'ثبت و استفادهٔ تازه از معرفی',
  walletActivationSmsEnabled: 'امکان ارسال پیامک فعال‌سازی اعتبار',
  purchaseRewardWorkerEnabled: 'پردازش پاداش خرید',
  referralGrantWorkerEnabled: 'پردازش پاداش معرفی',
  referralRiskWorkerEnabled: 'ارزیابی پس‌زمینهٔ ریسک معرفی',
  walletMaintenanceEnabled: 'نگهداشت و تطبیق کیف پول',
} as const;

export type ApiFlag = keyof typeof apiFlagLabels;
export type RolloutStatus = IssuanceState & Record<ApiFlag, boolean>;

export function readIssuanceState(value: unknown): IssuanceState | null {
  if (!value || typeof value !== 'object') return null;
  const { mode, version, changedAt } = value as Record<string, unknown>;
  if (
    typeof mode !== 'string' ||
    !Object.hasOwn(issuanceLabels, mode) ||
    typeof version !== 'number' ||
    !Number.isInteger(version) ||
    version < 1 ||
    typeof changedAt !== 'string' ||
    !Number.isFinite(Date.parse(changedAt))
  )
    return null;
  return { mode: mode as IssuanceMode, version, changedAt };
}
