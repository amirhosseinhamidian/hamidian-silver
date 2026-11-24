export const referralPath = '/account/referrals';
export const referralCodePattern = /^[A-Za-z0-9_-]{24}$/;

export type ReferralHistoryItem = {
  id: string;
  status: 'PENDING' | 'FIRST_PURCHASE_CONFIRMED' | 'EXPIRED';
  claimedAt: string;
  expiresAt: string;
  firstPaidAt: string | null;
};

export type ReceivedReferral = ReferralHistoryItem & { firstOrderId: string | null };

export type ReferralOverview = {
  enabled: boolean;
  referrerEligible: boolean;
  attributionDays: number;
  code: string | null;
  incoming: ReceivedReferral | null;
  outgoing: { items: ReferralHistoryItem[]; page: number; hasMore: boolean };
};

const messages: Record<string, string> = {
  REFERRAL_DISABLED: 'ثبت معرفی در حال حاضر فعال نیست.',
  REFERRAL_INVALID_CODE: 'این کد معرفی معتبر نیست.',
  REFERRAL_VERIFICATION_REQUIRED: 'برای معرفی، شمارهٔ همراه حساب باید تأیید شده باشد.',
  REFERRAL_SELF: 'کد معرفی خودتان برای این حساب قابل ثبت نیست.',
  REFERRAL_ALREADY_CLAIMED: 'قبلاً یک کد معرفی برای این حساب ثبت شده است.',
  REFERRAL_FIRST_PURCHASE_EXISTS: 'مهلت ثبت کد با تأیید اولین پرداخت این حساب پایان یافته است.',
  REFERRAL_ACCOUNT_INELIGIBLE: 'این حساب شرایط ثبت معرفی را ندارد.',
  REFERRAL_REFERRER_PURCHASE_REQUIRED:
    'صدور و استفاده از کد معرفی به یک خرید پرداخت‌شده و تحویل‌گرفته‌شدهٔ معرف نیاز دارد.',
  BAD_REQUEST: 'کد معرفی را کامل و بدون فاصله وارد کنید.',
};

export async function referralError(response: Response) {
  if (response.status === 429) return 'تعداد درخواست‌ها زیاد است. چند دقیقه بعد دوباره تلاش کنید.';
  const body = (await response.json().catch(() => null)) as { error?: { code?: string } } | null;
  const code = body?.error?.code;
  return code && Object.hasOwn(messages, code)
    ? messages[code]
    : 'نتیجهٔ درخواست مشخص نیست. وضعیت معرفی را بررسی کنید و دوباره تلاش کنید.';
}

export function referralCodeFromHash(hash: string) {
  const code = new URLSearchParams(hash.slice(1)).get('code');
  return code && referralCodePattern.test(code) ? code : '';
}

export function referralLink(code: string) {
  return `${referralPath}#code=${encodeURIComponent(code)}`;
}
