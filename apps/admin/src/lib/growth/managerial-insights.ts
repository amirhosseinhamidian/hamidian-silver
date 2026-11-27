import { readCalendarValue, todayInTehran } from '../presentation/dual-calendar';
import { previousGrowthPeriod, type GrowthDashboard } from './growth-report';

export const minimumPeriodPurchases = 20;
export const materialPurchaseChangePercent = 30;
export const quotaRemainingThreshold = 20;
export const discountCommitmentThreshold = 80;

type PeriodPurchases = Pick<GrowthDashboard, 'period' | 'generatedAt'> & {
  totals: Pick<GrowthDashboard['totals'], 'confirmedOrders'>;
};

export function confirmedPurchaseChange(current: PeriodPurchases, previous: PeriodPurchases) {
  const expected = previousGrowthPeriod(current.period);
  const generatedAt = new Date(current.generatedAt);
  const lastDay = readCalendarValue(current.period.to, 'date');
  if (
    !expected ||
    previous.period.from !== expected.from ||
    previous.period.to !== expected.to ||
    previous.period.timezone !== current.period.timezone ||
    !lastDay ||
    !Number.isFinite(generatedAt.getTime()) ||
    lastDay.day >= todayInTehran(generatedAt)
  )
    return null;

  const currentPurchases = current.totals.confirmedOrders;
  const previousPurchases = previous.totals.confirmedOrders;
  if (Math.min(currentPurchases, previousPurchases) < minimumPeriodPurchases) return null;

  const percent = (100 * (currentPurchases - previousPurchases)) / previousPurchases;
  if (Math.abs(percent) < materialPurchaseChangePercent) return null;
  return { currentPurchases, previousPurchases, percent };
}

export function isQuotaNearEnd({ limit, remaining }: { limit: number; remaining: number }) {
  return limit > 0 && remaining > 0 && remaining * 100 <= limit * quotaRemainingThreshold;
}

export function discountCommitmentSignal(limit: number, committed: number) {
  if (limit <= 0 || committed * 100 < limit * discountCommitmentThreshold) return null;
  return { percent: (100 * committed) / limit, exhausted: committed >= limit };
}
