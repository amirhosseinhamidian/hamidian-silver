import { describe, expect, it } from 'vitest';
import { calculatePublicShippingCost } from '@/lib/shipping/public-shipping-pricing';

describe('calculatePublicShippingCost', () => {
  it('supports free, fixed and threshold-discounted shipping', () => {
    expect(
      calculatePublicShippingCost(
        { mode: 'FREE', baseCostToman: 0, thresholdToman: null, discountedCostToman: null },
        500_000,
      ),
    ).toBe(0);

    const policy = {
      mode: 'FIXED' as const,
      baseCostToman: 100_000,
      thresholdToman: 3_000_000,
      discountedCostToman: 20_000,
    };
    expect(calculatePublicShippingCost(policy, 2_999_999)).toBe(100_000);
    expect(calculatePublicShippingCost(policy, 3_000_000)).toBe(20_000);
  });
});
