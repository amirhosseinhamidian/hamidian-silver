import {
  calendarDay,
  formatCalendarDay,
  readCalendarValue,
} from '@/lib/presentation/dual-calendar';
import { parseAdminWholeToman, toAsciiDigits } from '@/lib/presentation/formatters';

export const referralPolicyPath = '/reward-policies/referrals';
export const referralRecipients = [
  { value: 'REFERRER', label: 'معرف' },
  { value: 'REFERRED', label: 'معرفی‌شونده' },
] as const;
export const purchaseRanks = [
  { value: 'FIRST', label: 'خرید اول' },
  { value: 'SECOND', label: 'خرید دوم' },
  { value: 'THIRD_OR_LATER', label: 'خرید سوم به بعد' },
  { value: 'ANY', label: 'هر مرتبه' },
] as const;
export const rewardMethods = [
  { value: 'FIXED', label: 'مبلغ ثابت به تومان' },
  { value: 'PERCENT', label: 'نرخ درصدی' },
] as const;

export type ReferralRecipient = (typeof referralRecipients)[number]['value'];
export type ReferralRule = {
  code: string;
  recipient: ReferralRecipient;
  enabled: boolean;
  priority: number;
  purchaseRank: (typeof purchaseRanks)[number]['value'];
  method: (typeof rewardMethods)[number]['value'];
  value: number;
  minimumToman: number;
  maximumExclusiveToman?: number | null;
  capToman: number;
  startsAt?: string | null;
  endsAt?: string | null;
  expiryDays: number;
  maxUsesPerRecipient: number;
  periodBudgetToman: number;
  campaignIds: string[];
  allowedCategoryIds: string[];
  allowCampaign: boolean;
  allowCoupon: boolean;
  allowPurchaseReward: boolean;
};
export type ReferralDefinition = {
  enabled: boolean;
  periodBudgetToman: number;
  rules: ReferralRule[];
};
export type ReferralVersion = {
  version: number;
  enabled: boolean;
  createdAt: string;
  createdById: string;
  requestedEffectiveAt: string | null;
  publishedAt: string | null;
  publishedById: string | null;
  effectiveAt: string | null;
};
export type ReferralVersionDetail = ReferralVersion & { definition: ReferralDefinition };
export type ReferralVersionList = {
  page: number;
  hasMore: boolean;
  active: ReferralVersionDetail | null;
  items: ReferralVersion[];
};
export type ReferralRewardPreview = {
  recipients: {
    recipient: ReferralRecipient;
    ruleCode: string | null;
    reason: string;
    eligibleToman: number;
    amountToman: number;
    expiryDays: number | null;
  }[];
  totalToman: number;
};

const tehranDateTime = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Tehran',
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

export function referralLocalDate(value: string | null | undefined) {
  if (!value) return '';
  const parts = Object.fromEntries(
    tehranDateTime.formatToParts(new Date(value)).map(({ type, value }) => [type, value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function referralInstant(value: string) {
  if (!value) return null;
  const calendar = readCalendarValue(value, 'date-time');
  const local = calendar ? `${formatCalendarDay(calendar.day, 'gregory')}T${calendar.time}` : value;
  const wallTime = Date.parse(`${local}Z`);
  if (!Number.isFinite(wallTime)) throw new Error('تاریخ و ساعت معتبر وارد کنید.');
  const tehranProjected = Date.parse(`${referralLocalDate(new Date(wallTime).toISOString())}Z`);
  return new Date(wallTime - (tehranProjected - wallTime)).toISOString();
}

export function referralCalendarValue(value: string | null | undefined) {
  const local = referralLocalDate(value);
  if (!local) return '';
  const [date, time] = local.split('T');
  const [year, month, day] = date.split('-').map(Number);
  const serial = calendarDay('gregory', year, month, day);
  return serial === null ? '' : `${formatCalendarDay(serial, 'persian')} ${time}`;
}

export function readReferralText(data: FormData, name: string) {
  return String(data.get(name) ?? '').trim();
}

export function readReferralNumber(
  data: FormData,
  name: string,
  label: string,
  max = 2_147_483_647,
) {
  const amount = parseAdminWholeToman(readReferralText(data, name));
  if (amount === null || !Number.isSafeInteger(amount) || amount > max)
    throw new Error(`${label} را با عدد صحیح معتبر وارد کنید.`);
  return amount;
}

export function readReferralPercent(data: FormData, name: string) {
  const raw = toAsciiDigits(readReferralText(data, name)).replace('٫', '.');
  if (!/^\d{1,3}(?:\.\d{1,2})?$/.test(raw))
    throw new Error('نرخ پاداش را به درصد و حداکثر با دو رقم اعشار وارد کنید.');
  const [whole, decimal = ''] = raw.split('.');
  const rate = Number(whole) * 100 + Number(decimal.padEnd(2, '0'));
  if (rate > 10_000) throw new Error('نرخ پاداش نمی‌تواند بیش از ۱۰۰٪ باشد.');
  return rate;
}

export function readReferralIds(data: FormData, name: string) {
  const input = readReferralText(data, name);
  if (!input) return [];
  const ids = [...new Set(input.toLowerCase().split(/[\s,،]+/))];
  if (
    ids.length > 50 ||
    ids.some((id) => !/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(id))
  ) {
    throw new Error('شناسه‌های دسته و کمپین را با فاصله یا کاما جدا کنید.');
  }
  return ids;
}

export async function referralPolicyResponse<T>(response: Response): Promise<T> {
  if (response.ok) return response.json() as Promise<T>;
  const payload = (await response.json().catch(() => null)) as {
    error?: { message?: string };
  } | null;
  if (response.status === 400) {
    const message = payload?.error?.message;
    throw new Error(
      message && /[\u0600-\u06ff]/.test(message)
        ? message
        : 'مقادیر، زمان‌ها و محدودهٔ عددی فیلدها را بررسی کنید.',
    );
  }
  if (response.status === 401 || response.status === 403)
    throw new Error('نشست یا مجوز مالی لازم را بررسی کنید.');
  if (response.status === 409)
    throw new Error('درخواست با وضعیت موجود هم‌خوانی ندارد. صفحه را به‌روز کنید.');
  throw new Error('نتیجهٔ درخواست مشخص نیست. دوباره تلاش کنید.');
}
