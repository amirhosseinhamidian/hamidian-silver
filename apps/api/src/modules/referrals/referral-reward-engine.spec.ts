import { evaluateReferralRewards, validateReferralRewardPolicy } from './referral-reward-engine';
import type {
  ReferralRewardDefinitionDto,
  ReferralRewardRuleDto,
  ReferralRewardSampleDto,
} from './dto/referral-reward-policy.dto';

const rule: ReferralRewardRuleDto = {
  code: 'intro',
  recipient: 'REFERRER',
  enabled: true,
  priority: 10,
  purchaseRank: 'FIRST',
  method: 'PERCENT',
  value: 1250,
  minimumToman: 10_000,
  maximumExclusiveToman: 100_000,
  capToman: 8_000,
  startsAt: '2026-11-01T00:00:00Z',
  endsAt: '2026-12-01T00:00:00Z',
  expiryDays: 90,
  campaignIds: [],
  allowedCategoryIds: [],
  allowCoupon: false,
  allowCampaign: true,
  allowPurchaseReward: false,
  maxUsesPerRecipient: 2,
  periodBudgetToman: 20_000,
};
const definition: ReferralRewardDefinitionDto = {
  enabled: true,
  periodBudgetToman: 10_000,
  rules: [rule],
};
const sample: ReferralRewardSampleDto = {
  occurredAt: '2026-11-24T00:00:00Z',
  purchaseRank: 1,
  confirmed: true,
  couponApplied: false,
  purchaseRewardApplied: false,
  campaignId: null,
  lines: [{ eligibleToman: 30_007, categoryIds: [] }],
  usage: [],
  programCommittedToman: 0,
  remainingIncentiveToman: 50_000,
};

describe('referral reward policies', () => {
  it('applies the selected recipient, floors percentage amounts and caps the period', () => {
    expect(evaluateReferralRewards(definition, sample).recipients).toEqual([
      expect.objectContaining({
        recipient: 'REFERRER',
        ruleCode: 'intro',
        amountToman: 3750,
        expiryDays: 90,
      }),
      expect.objectContaining({ recipient: 'REFERRED', amountToman: 0, reason: 'NO_MATCH' }),
    ]);
    expect(
      evaluateReferralRewards(definition, { ...sample, programCommittedToman: 9_000 }).totalToman,
    ).toBe(1_000);
  });

  it('honors ranks, combination exclusions, campaign scopes and half-open bands', () => {
    for (const override of [
      { purchaseRank: 2 },
      { couponApplied: true },
      { purchaseRewardApplied: true },
      { occurredAt: rule.endsAt! },
      { lines: [{ eligibleToman: 100_000, categoryIds: [] }] },
    ]) {
      expect(evaluateReferralRewards(definition, { ...sample, ...override }).totalToman).toBe(0);
    }
    expect(evaluateReferralRewards(definition, { ...sample, confirmed: false }).totalToman).toBe(0);
    expect(
      evaluateReferralRewards(definition, {
        ...sample,
        usage: [
          {
            ruleCode: 'intro',
            recipientUses: 2,
            committedToman: 0,
          },
        ],
      }).recipients[0].reason,
    ).toBe('USE_LIMIT');
  });

  it('adds recipient rules independently without spending more than remaining incentives', () => {
    const both: ReferralRewardDefinitionDto = {
      ...definition,
      rules: [
        rule,
        {
          ...rule,
          recipient: 'REFERRED',
          code: 'guest',
          method: 'FIXED',
          value: 5_000,
          priority: 20,
        },
      ],
    };
    const result = evaluateReferralRewards(both, { ...sample, remainingIncentiveToman: 6_000 });
    expect(result.totalToman).toBe(6_000);
    expect(result.recipients.map((row) => row.amountToman).sort((a, b) => a - b)).toEqual([
      1_000, 5_000,
    ]);
  });

  it('rejects duplicate rule codes, invalid bands and rates above 100 percent', () => {
    expect(() => validateReferralRewardPolicy({ ...definition, rules: [rule, rule] })).toThrow();
    expect(() =>
      validateReferralRewardPolicy({ ...definition, rules: [{ ...rule, value: 10_001 }] }),
    ).toThrow();
    expect(() =>
      validateReferralRewardPolicy({
        ...definition,
        rules: [{ ...rule, maximumExclusiveToman: 10_000 }],
      }),
    ).toThrow();
  });
});
