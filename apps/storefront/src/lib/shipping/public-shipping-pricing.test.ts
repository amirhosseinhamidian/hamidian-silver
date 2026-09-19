import { describe, expect, it } from 'vitest';

import {
  calculatePublicShippingCost,
  calculateShippingOptionCost,
  shippingOptionSupportsDestination,
  type PublicShippingOption,
} from './public-shipping-pricing';

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

const fixedOption: PublicShippingOption = {
  id: '10000000-0000-4000-8000-000000000001',
  name: 'پست',
  logo: null,
  pricingMode: 'FIXED',
  baseCostToman: 100_000,
  thresholdToman: 3_000_000,
  discountedCostToman: 0,
  serviceArea: 'NATIONWIDE',
};

describe('public shipping options', () => {
  it('calculates each carrier cost independently', () => {
    expect(calculateShippingOptionCost(fixedOption, 2_999_999)).toBe(100_000);
    expect(calculateShippingOptionCost(fixedOption, 3_000_000)).toBe(0);
  });

  it('only offers Tehran courier delivery inside Tehran city', () => {
    const courier = {
      ...fixedOption,
      pricingMode: 'COLLECT',
      baseCostToman: 0,
      thresholdToman: null,
      discountedCostToman: null,
      serviceArea: 'TEHRAN_ONLY',
    } satisfies PublicShippingOption;

    expect(shippingOptionSupportsDestination(courier, { province: 'تهران', city: 'تهران' })).toBe(
      true,
    );
    expect(shippingOptionSupportsDestination(courier, { province: 'تهران', city: 'شهریار' })).toBe(
      false,
    );
    expect(shippingOptionSupportsDestination(courier, { province: 'اصفهان', city: 'اصفهان' })).toBe(
      false,
    );
  });
});
