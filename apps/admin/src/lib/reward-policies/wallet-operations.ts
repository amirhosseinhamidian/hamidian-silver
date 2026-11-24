import type { components } from '@hamidian/contracts';

export const walletOperationsPath = '/reward-policies/wallet-operations';
export const walletUuid = /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i;

export type AdminWalletBalance = components['schemas']['WalletBalanceDto'] & {
  nextExpiryToman?: number;
};
export type AdminWalletLedger = components['schemas']['WalletLedgerPageDto'];
export type PolicyVersionPage = components['schemas']['RewardPolicyListDto'];
export type PolicyVersion = components['schemas']['RewardPolicyDetailDto'];

export const rewardJobLabels = {
  PENDING: 'در صف',
  PROCESSING: 'در حال پردازش',
  WAITING: 'در انتظار فعال‌سازی',
  COMPLETED: 'تکمیل‌شده',
  SKIPPED: 'بدون پاداش',
  DEAD_LETTER: 'نیازمند پیگیری',
};
export type CustomerRewardJob = {
  orderId: string;
  orderNumber: string;
  status: keyof typeof rewardJobLabels;
  attempts: number;
  resultCode: string | null;
  reviewHeldAt: string | null;
  nextAttemptAt: string;
};
export type RewardJobPage = { items: CustomerRewardJob[]; page: number; hasMore: boolean };
