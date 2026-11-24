import type { RewardPolicyDefinitionDto, SimulateRewardPolicyDto } from './dto/reward-policy.dto';
import { calculateRewardPolicy, validateRewardPolicy } from './reward-policy-engine';

const normalProduct = '456886e4-7a4c-4cb4-90c2-eed836202d31';
const excludedProduct = '3e40752a-572d-4c0c-a1d8-29202aa91447';
const normalCategory = 'db2bb4f2-ee61-476c-a562-f0482e18b025';
const excludedCategory = 'a018e388-3d9e-462b-aff8-d8bca1689b0a';

const eligibility = {
  allowCoupon: true,
  allowedCategoryIds: [normalCategory],
  excludedCategoryIds: [excludedCategory],
  excludedProductIds: [excludedProduct],
};
const band = { enabled: true, priority: 10, capToman: 500_000, minimumToman: 1 };
const policy: RewardPolicyDefinitionDto = {
  enabled: true,
  expiryDays: 270,
  grantEligibility: eligibility,
  redemptionEligibility: eligibility,
  budget: {
    rewardPerOrderToman: 500_000,
    rewardPerCustomerPeriodToman: 1_000_000,
    rewardPerPeriodToman: 5_000_000,
    incentivesPerOrderToman: 2_000_000,
    incentivesPerCustomerPeriodToman: 3_000_000,
    incentivesPerPeriodToman: 10_000_000,
  },
  grantRules: [
    { ...band, code: 'first', purchaseRank: 'FIRST', method: 'FIXED', value: 30_000 },
    { ...band, code: 'second', purchaseRank: 'SECOND', method: 'PERCENT', value: 100 },
    { ...band, code: 'repeat', purchaseRank: 'THIRD_OR_LATER', method: 'PERCENT', value: 200 },
  ],
  redemptionBands: [
    {
      ...band,
      code: 'three',
      minimumToman: 3_000_000,
      maximumExclusiveToman: 5_000_000,
      rateBps: 500,
      capToman: 250_000,
    },
    {
      ...band,
      code: 'five',
      minimumToman: 5_000_000,
      maximumExclusiveToman: 10_000_000,
      rateBps: 500,
      capToman: 250_000,
    },
    { ...band, code: 'ten', minimumToman: 10_000_000, rateBps: 800 },
  ],
};

function sample(merchandiseToman: number): SimulateRewardPolicyDto {
  return {
    lines: [
      {
        productId: normalProduct,
        categoryIds: [normalCategory],
        merchandiseToman,
        directDiscountToman: 0,
        settledCreditToman: 0,
        refundedCashToman: 0,
      },
    ],
    outcome: 'PAID',
    previousCompletedPurchases: 1,
    couponApplied: false,
    shippingDiscountToman: 0,
    otherOrderIncentivesToman: 0,
    availableCreditToman: 1_000_000,
    usage: {
      customerRewardsToman: 0,
      periodRewardsToman: 0,
      customerIncentivesToman: 0,
      periodIncentivesToman: 0,
    },
  };
}

describe('reward policy calculator', () => {
  it.each<[number, string | null, number]>([
    [2_999_999, null, 0],
    [3_000_000, 'three', 150_000],
    [4_999_999, 'three', 249_999],
    [5_000_000, 'five', 250_000],
    [9_999_999, 'five', 250_000],
    [10_000_000, 'ten', 500_000],
  ])('selects the redemption band at %d', (price, code, limit) => {
    validateRewardPolicy(policy);
    expect(calculateRewardPolicy(1, policy, sample(price))).toMatchObject({
      redemptionBandCode: code,
      maxRedemptionToman: limit,
    });
  });

  it('caps the second purchase and selects the first and repeat rules separately', () => {
    expect(calculateRewardPolicy(1, policy, sample(60_000_000))).toMatchObject({
      purchaseRank: 'SECOND',
      calculatedRewardToman: 600_000,
      estimatedRewardToman: 500_000,
    });
    expect(
      calculateRewardPolicy(1, policy, { ...sample(5_000_000), previousCompletedPurchases: 0 }),
    ).toMatchObject({ purchaseRank: 'FIRST', estimatedRewardToman: 30_000 });
    expect(
      calculateRewardPolicy(1, policy, { ...sample(5_000_000), previousCompletedPurchases: 2 }),
    ).toMatchObject({ purchaseRank: 'THIRD_OR_LATER', estimatedRewardToman: 100_000 });
  });

  it('subtracts direct discounts, used credit and cash refunds without rewarding exclusions', () => {
    const input = sample(10_500_000);
    const [line] = input.lines;
    input.lines = [
      {
        ...line,
        directDiscountToman: 500_000,
        settledCreditToman: 500_000,
        refundedCashToman: 1_000_000,
      },
      { ...line, productId: excludedProduct },
      { ...line, categoryIds: [normalCategory, excludedCategory] },
    ];
    input.availableCreditToman = 150_000;
    input.campaignRedemptionCapToman = 120_000;
    input.shippingDiscountToman = 75_000;
    expect(calculateRewardPolicy(8, policy, input)).toMatchObject({
      version: 8,
      rewardBaseToman: 8_500_000,
      redemptionBaseToman: 10_000_000,
      estimatedRewardToman: 85_000,
      maxRedemptionToman: 120_000,
      existingOrderIncentivesToman: 575_000,
    });
    expect(
      calculateRewardPolicy(8, policy, { ...input, campaignRedemptionCapToman: null }),
    ).toMatchObject({ maxRedemptionToman: 150_000 });
    expect(calculateRewardPolicy(8, policy, { ...input, outcome: 'FULLY_RETURNED' })).toMatchObject(
      { estimatedRewardToman: 0, maxRedemptionToman: 0 },
    );
  });

  it('applies exact remaining budgets, and previews rather than grants on unpaid orders', () => {
    const input = sample(60_000_000);
    input.otherOrderIncentivesToman = 100_000;
    input.usage = {
      customerRewardsToman: 800_000,
      periodRewardsToman: 4_700_000,
      customerIncentivesToman: 2_850_000,
      periodIncentivesToman: 9_800_000,
    };
    expect(calculateRewardPolicy(1, policy, input)).toMatchObject({
      estimatedRewardToman: 50_000,
      remainingRewardBudgetToman: 50_000,
      existingIncentivesExceedLimit: false,
    });
    expect(
      calculateRewardPolicy(1, policy, { ...input, otherOrderIncentivesToman: 151_000 }),
    ).toMatchObject({ estimatedRewardToman: 0, existingIncentivesExceedLimit: true });
    expect(calculateRewardPolicy(1, policy, { ...input, outcome: 'UNPAID' })).toMatchObject({
      estimatedRewardToman: 0,
      maxRedemptionToman: 500_000,
    });
  });

  it('counts another recipient’s order credit only against the shared incentive caps', () => {
    const input = sample(5_000_000);
    input.otherOrderIncentivesToman = 30_000;
    const definition = {
      ...policy,
      budget: {
        ...policy.budget,
        incentivesPerCustomerPeriodToman: 35_000,
        incentivesPerOrderToman: 50_000,
      },
    };
    expect(
      calculateRewardPolicy(1, definition, {
        ...input,
        otherCustomerOrderIncentivesToman: 0,
      }),
    ).toMatchObject({ existingOrderIncentivesToman: 30_000, estimatedRewardToman: 20_000 });
  });

  it('uses priority, rejects ambiguous rules and applies coupon eligibility independently', () => {
    const override = {
      ...policy.grantRules[1],
      code: 'priority',
      priority: 20,
      method: 'FIXED' as const,
      value: 25_000,
    };
    const adjusted = {
      ...policy,
      grantRules: [...policy.grantRules, override],
      redemptionEligibility: { ...eligibility, allowCoupon: false },
    };
    validateRewardPolicy(adjusted);
    expect(
      calculateRewardPolicy(2, adjusted, { ...sample(5_000_000), couponApplied: true }),
    ).toMatchObject({
      grantRuleCode: 'priority',
      estimatedRewardToman: 25_000,
      maxRedemptionToman: 0,
    });
    expect(() =>
      validateRewardPolicy({
        ...adjusted,
        grantRules: [...adjusted.grantRules, { ...override, code: 'ambiguous' }],
      }),
    ).toThrow('same priority');
    expect(
      calculateRewardPolicy(3, { ...adjusted, enabled: false }, sample(5_000_000)),
    ).toMatchObject({ estimatedRewardToman: 0, maxRedemptionToman: 0 });
  });

  it('rejects inconsistent monetary inputs instead of silently issuing credit', () => {
    const input = sample(5_000_000);
    const [line] = input.lines;
    expect(() =>
      calculateRewardPolicy(1, policy, {
        ...input,
        lines: [{ ...line, settledCreditToman: 4_000_000, refundedCashToman: 1_000_001 }],
      }),
    ).toThrow('exceeds the original merchandise');
    expect(() =>
      calculateRewardPolicy(1, policy, {
        ...input,
        usage: { ...input.usage, customerRewardsToman: 1 },
      }),
    ).toThrow('totals are inconsistent');
  });
});
