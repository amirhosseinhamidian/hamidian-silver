import type { components } from '@hamidian/contracts';

export type CampaignDetail = components['schemas']['CampaignDetailDto'];
export type CampaignSummary = components['schemas']['CampaignSummaryDto'];
export type CampaignMedia = components['schemas']['CampaignMediaDto'];
export type CampaignDraft = components['schemas']['CreateCampaignDto'];
export type CampaignAction = components['schemas']['CampaignTransitionDto']['action'];

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
  PAUSE: 'توقف موقت',
  RESUME: 'زمان‌بندی دوباره',
  REOPEN: 'بازگشت به پیش‌نویس',
  END: 'پایان کمپین',
};

export function isCampaignId(value: string) {
  return /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(value);
}
