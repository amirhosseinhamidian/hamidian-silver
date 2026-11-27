import { describe, expect, it } from 'vitest';
import {
  confirmedPurchaseChange,
  discountCommitmentSignal,
  isQuotaNearEnd,
} from './managerial-insights';

const timezone = 'Asia/Tehran' as const;
const current = {
  period: { from: '2026-11-24', to: '2026-11-25', timezone },
  generatedAt: '2026-11-25T20:30:00Z',
  totals: { confirmedOrders: 26 },
};
const previous = {
  ...current,
  period: { from: '2026-11-22', to: '2026-11-23', timezone },
  totals: { confirmedOrders: 20 },
};

describe('managerial insight rules', () => {
  it('compares completed Tehran dates using the previous period as the denominator', () => {
    expect(confirmedPurchaseChange(current, previous)).toEqual({
      currentPurchases: 26,
      previousPurchases: 20,
      percent: 30,
    });
    expect(
      confirmedPurchaseChange(
        { ...current, totals: { confirmedOrders: 21 } },
        { ...previous, totals: { confirmedOrders: 30 } },
      )?.percent,
    ).toBe(-30);
  });

  it('suppresses partial days, off-period comparisons, small samples and smaller changes', () => {
    expect(
      confirmedPurchaseChange({ ...current, generatedAt: '2026-11-25T20:29:59Z' }, previous),
    ).toBeNull();
    expect(confirmedPurchaseChange(current, { ...previous, period: current.period })).toBeNull();
    expect(
      confirmedPurchaseChange(current, { ...previous, totals: { confirmedOrders: 19 } }),
    ).toBeNull();
    expect(
      confirmedPurchaseChange({ ...current, totals: { confirmedOrders: 25 } }, previous),
    ).toBeNull();
  });

  it('distinguishes near-limit quota and comparable budget from exhausted or missing capacity', () => {
    expect(isQuotaNearEnd({ limit: 10, remaining: 2 })).toBe(true);
    expect(isQuotaNearEnd({ limit: 10, remaining: 3 })).toBe(false);
    expect(isQuotaNearEnd({ limit: 10, remaining: 0 })).toBe(false);
    expect(discountCommitmentSignal(10_000, 7_999)).toBeNull();
    expect(discountCommitmentSignal(0, 1_000)).toBeNull();
    expect(discountCommitmentSignal(10_000, 8_000)).toEqual({ percent: 80, exhausted: false });
    expect(discountCommitmentSignal(10_000, 11_000)).toEqual({ percent: 110, exhausted: true });
  });
});
