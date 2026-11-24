import type { components } from '@hamidian/contracts';

export type WalletBalance = components['schemas']['WalletBalanceDto'] & {
  nextExpiryToman?: number;
};

export const walletUnavailableText = {
  MINIMUM_CASH: 'مبلغ سفارش باید از حداقل پرداخت نقدی بیشتر باشد.',
  POLICY_DISABLED: 'مصرف اعتبار در حال حاضر فعال نیست.',
  NO_AVAILABLE_CREDIT: 'اعتبار قابل مصرف در دسترس نیست.',
  COUPON_EXCLUDED: 'این کد تخفیف با اعتبار کیف پول قابل ترکیب نیست.',
  NO_ELIGIBLE_ITEMS: 'کالاهای این سبد مشمول مصرف اعتبار نیستند.',
  POLICY_LIMIT: 'مبلغ کالاهای مشمول به حد لازم برای مصرف اعتبار نمی‌رسد.',
};

export type WalletPreview = {
  walletAppliedToman: number;
  walletUnavailableReason: keyof typeof walletUnavailableText | null;
};

export function walletReason(reason: string | null | undefined) {
  return reason && Object.hasOwn(walletUnavailableText, reason)
    ? walletUnavailableText[reason as keyof typeof walletUnavailableText]
    : 'برای این سفارش اعتبار قابل اعمال نیست.';
}

const dateFormat = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
  dateStyle: 'long',
  timeStyle: 'short',
  timeZone: 'Asia/Tehran',
});

export function formatWalletDate(value: string) {
  const date = new Date(value);
  return Number.isFinite(+date) ? dateFormat.format(date) : '—';
}
