import type { components } from '@hamidian/contracts';

export type CampaignDetail = components['schemas']['CampaignDetailDto'];
export type CampaignSummary = components['schemas']['CampaignSummaryDto'];
export type CampaignMedia = components['schemas']['CampaignMediaDto'];
export type CampaignDraft = components['schemas']['CreateCampaignDto'];
export type CampaignAction = components['schemas']['CampaignTransitionDto']['action'];

export const campaignAudienceLabels: Record<CampaignDetail['audience'], string> = {
  ALL_CUSTOMERS: 'همهٔ مشتریان',
  FIRST_PURCHASE: 'مشتری بدون خرید پرداخت‌شده',
  RETURNING: 'مشتری دارای خرید پرداخت‌شده',
};

export const campaignAudienceOptions = Object.entries(campaignAudienceLabels).map(
  ([value, label]) => ({ value, label }),
);

export const campaignKindLabels: Record<CampaignSummary['kind'], string> = {
  LEGACY: 'کمپین قبلی',
  MARKETING: 'کمپین بازاریابی',
  FESTIVAL: 'جشنوارهٔ فروش',
};

export const campaignStatusLabels: Record<CampaignSummary['status'], string> = {
  DRAFT: 'پیش‌نویس',
  APPROVED: 'تأییدشده',
  SCHEDULED: 'زمان‌بندی‌شده',
  ACTIVE: 'فعال',
  PAUSED: 'متوقف',
  ENDED: 'پایان‌یافته',
};

export const campaignActionLabels: Record<CampaignAction, string> = {
  APPROVE: 'تأیید پیش‌نویس',
  SCHEDULE: 'زمان‌بندی انتشار',
  PUBLISH_NOW: 'انتشار فوری',
  PAUSE: 'توقف موقت',
  RESUME: 'زمان‌بندی دوباره',
  REOPEN: 'بازگشت به پیش‌نویس',
  END: 'پایان کمپین',
  ARCHIVE: 'بایگانی جشنواره',
};

export function isCampaignId(value: string) {
  return /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(value);
}
