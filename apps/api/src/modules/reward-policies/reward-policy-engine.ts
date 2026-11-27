import { isNonNegativeTomanInt, TOMAN_INT_MAX } from '../../common/toman';
import type {
  RewardBandDto,
  RewardEligibilityDto,
  RewardGrantRuleDto,
  RewardPolicyDefinitionDto,
  RewardSampleLineDto,
  RewardSimulationDto,
  SimulateRewardPolicyDto,
} from './dto/reward-policy.dto';

const basisPointsPerUnit = 10_000;

export class RewardPolicyValidationError extends Error {}

function validateBands<T extends RewardBandDto>(
  bands: readonly T[],
  shareAudience: (left: T, right: T) => boolean,
) {
  const codes = new Set<string>();
  const enabled: T[] = [];
  for (const band of bands) {
    if (codes.has(band.code))
      throw new RewardPolicyValidationError(`Duplicate policy rule code: ${band.code}.`);
    codes.add(band.code);
    if (band.maximumExclusiveToman != null && band.minimumToman >= band.maximumExclusiveToman)
      throw new RewardPolicyValidationError(`Invalid amount range for rule ${band.code}.`);
    if (!band.enabled) continue;
    const overlaps = enabled.some(
      (other) =>
        band.priority === other.priority &&
        shareAudience(band, other) &&
        band.minimumToman < (other.maximumExclusiveToman ?? Infinity) &&
        other.minimumToman < (band.maximumExclusiveToman ?? Infinity),
    );
    if (overlaps)
      throw new RewardPolicyValidationError(
        `Rule ${band.code} overlaps another enabled rule at the same priority.`,
      );
    enabled.push(band);
  }
}

export function validateRewardPolicy(policy: RewardPolicyDefinitionDto) {
  validateBands(
    policy.grantRules,
    (left, right) =>
      left.purchaseRank === 'ANY' ||
      right.purchaseRank === 'ANY' ||
      left.purchaseRank === right.purchaseRank,
  );
  validateBands(policy.redemptionBands, () => true);
  if (
    policy.grantRules.some((rule) => rule.method === 'PERCENT' && rule.value > basisPointsPerUnit)
  )
    throw new RewardPolicyValidationError('A percentage reward cannot exceed 100%.');
  if (
    policy.enabled &&
    ![...policy.grantRules, ...policy.redemptionBands].some((rule) => rule.enabled)
  )
    throw new RewardPolicyValidationError('An enabled policy needs at least one enabled rule.');
}

function applicableBand<T extends RewardBandDto>(bands: readonly T[], amount: number): T | null {
  if (amount <= 0) return null;
  let selected: T | null = null;
  for (const band of bands) {
    if (
      band.enabled &&
      amount >= band.minimumToman &&
      amount < (band.maximumExclusiveToman ?? Infinity) &&
      (!selected || band.priority > selected.priority)
    )
      selected = band;
  }
  return selected;
}

function eligibility(selector: RewardEligibilityDto, couponApplied: boolean) {
  const allow = new Set(selector.allowedCategoryIds.map((id) => id.toLowerCase()));
  const excludedCategories = new Set(selector.excludedCategoryIds.map((id) => id.toLowerCase()));
  const excludedProducts = new Set(selector.excludedProductIds.map((id) => id.toLowerCase()));
  return (line: Pick<RewardSampleLineDto, 'productId' | 'categoryIds'>) => {
    const categories = line.categoryIds.map((id) => id.toLowerCase());
    return (
      (!couponApplied || selector.allowCoupon) &&
      !excludedProducts.has(line.productId.toLowerCase()) &&
      !categories.some((id) => excludedCategories.has(id)) &&
      (allow.size === 0 || categories.some((id) => allow.has(id)))
    );
  };
}

export function percentage(amount: number, bps: number) {
  return Math.floor((amount * bps) / basisPointsPerUnit);
}

function remaining(limit: number, used: number) {
  return Math.max(0, limit - used);
}

export function calculateRedemption(
  policy: RewardPolicyDefinitionDto,
  lines: readonly Pick<
    RewardSampleLineDto,
    'productId' | 'categoryIds' | 'merchandiseToman' | 'directDiscountToman'
  >[],
  couponApplied: boolean,
  availableCreditToman: number,
  campaignCapToman = TOMAN_INT_MAX,
) {
  const eligible = eligibility(policy.redemptionEligibility, couponApplied);
  const weights = lines.map((line) =>
    eligible(line) ? line.merchandiseToman - line.directDiscountToman : 0,
  );
  const redemptionBaseToman = weights.reduce((sum, weight) => sum + weight, 0);
  const band = policy.enabled ? applicableBand(policy.redemptionBands, redemptionBaseToman) : null;
  return {
    weights,
    redemptionBaseToman,
    bandCode: band?.code ?? null,
    maximumToman: band
      ? Math.min(
          availableCreditToman,
          band.capToman,
          percentage(redemptionBaseToman, band.rateBps),
          campaignCapToman,
        )
      : 0,
  };
}

function calculatedReward(rule: RewardGrantRuleDto | null, base: number) {
  if (!rule) return 0;
  return rule.method === 'PERCENT' ? percentage(base, rule.value) : rule.value;
}

export function calculateRewardPolicy(
  version: number,
  policy: RewardPolicyDefinitionDto,
  sample: SimulateRewardPolicyDto & { otherCustomerOrderIncentivesToman?: number },
): RewardSimulationDto {
  const { budget } = policy;
  const { usage } = sample;
  const otherCustomerOrderIncentivesToman =
    sample.otherCustomerOrderIncentivesToman ?? sample.otherOrderIncentivesToman;
  if (
    Object.values(usage).some((value) => !Number.isSafeInteger(value) || value < 0) ||
    [
      sample.previousCompletedPurchases,
      sample.shippingDiscountToman,
      sample.otherOrderIncentivesToman,
      otherCustomerOrderIncentivesToman,
      sample.availableCreditToman,
      sample.campaignRedemptionCapToman ?? 0,
    ].some((value) => !isNonNegativeTomanInt(value)) ||
    otherCustomerOrderIncentivesToman > sample.otherOrderIncentivesToman
  )
    throw new RewardPolicyValidationError(
      'Sample amounts and counts must be nonnegative integers.',
    );
  if (
    usage.customerRewardsToman > usage.periodRewardsToman ||
    usage.customerIncentivesToman > usage.periodIncentivesToman ||
    usage.customerRewardsToman > usage.customerIncentivesToman ||
    usage.periodRewardsToman > usage.periodIncentivesToman
  )
    throw new RewardPolicyValidationError('Reward and incentive usage totals are inconsistent.');

  const grantEligible = eligibility(policy.grantEligibility, sample.couponApplied);
  let gross = 0;
  let rewardBaseToman = 0;
  let existingOrderIncentivesToman =
    sample.shippingDiscountToman + sample.otherOrderIncentivesToman;
  for (const line of sample.lines) {
    if (
      [
        line.merchandiseToman,
        line.directDiscountToman,
        line.settledCreditToman,
        line.refundedCashToman,
      ].some((value) => !isNonNegativeTomanInt(value))
    )
      throw new RewardPolicyValidationError('Line amounts must be nonnegative integer toman.');
    const net = line.merchandiseToman - line.directDiscountToman;
    const cash = net - line.settledCreditToman - line.refundedCashToman;
    if (cash < 0)
      throw new RewardPolicyValidationError(
        'A line discount, settled credit or cash refund exceeds the original merchandise amount.',
      );
    gross += line.merchandiseToman;
    existingOrderIncentivesToman += line.directDiscountToman;
    if (grantEligible(line) && sample.outcome === 'PAID') rewardBaseToman += cash;
  }
  if (gross > TOMAN_INT_MAX || existingOrderIncentivesToman > TOMAN_INT_MAX)
    throw new RewardPolicyValidationError(
      'The sample basket or incentive total exceeds the allowed amount.',
    );

  const purchaseRank =
    sample.previousCompletedPurchases === 0
      ? 'FIRST'
      : sample.previousCompletedPurchases === 1
        ? 'SECOND'
        : 'THIRD_OR_LATER';
  const grant = policy.enabled
    ? applicableBand(
        policy.grantRules.filter(
          ({ purchaseRank: rank }) => rank === 'ANY' || rank === purchaseRank,
        ),
        rewardBaseToman,
      )
    : null;
  const redemption = calculateRedemption(
    policy,
    sample.lines,
    sample.couponApplied,
    sample.availableCreditToman,
    sample.campaignRedemptionCapToman ?? undefined,
  );
  const canRedeem = sample.outcome !== 'CANCELLED' && sample.outcome !== 'FULLY_RETURNED';
  const existingCustomerOrderIncentivesToman =
    existingOrderIncentivesToman -
    sample.otherOrderIncentivesToman +
    otherCustomerOrderIncentivesToman;
  const remainingRewardBudgetToman = Math.min(
    budget.rewardPerOrderToman,
    remaining(budget.rewardPerCustomerPeriodToman, usage.customerRewardsToman),
    remaining(budget.rewardPerPeriodToman, usage.periodRewardsToman),
    remaining(budget.incentivesPerOrderToman, existingOrderIncentivesToman),
    remaining(
      remaining(budget.incentivesPerCustomerPeriodToman, usage.customerIncentivesToman),
      existingCustomerOrderIncentivesToman,
    ),
    remaining(
      remaining(budget.incentivesPerPeriodToman, usage.periodIncentivesToman),
      existingOrderIncentivesToman,
    ),
  );
  const calculatedRewardToman = calculatedReward(grant, rewardBaseToman);
  return {
    version,
    enabled: policy.enabled,
    purchaseRank,
    grantRuleCode: grant?.code ?? null,
    redemptionBandCode: canRedeem ? redemption.bandCode : null,
    rewardBaseToman,
    redemptionBaseToman: redemption.redemptionBaseToman,
    calculatedRewardToman,
    estimatedRewardToman: Math.min(
      calculatedRewardToman,
      grant?.capToman ?? 0,
      remainingRewardBudgetToman,
    ),
    maxRedemptionToman: canRedeem ? redemption.maximumToman : 0,
    existingOrderIncentivesToman,
    remainingRewardBudgetToman,
    existingIncentivesExceedLimit:
      existingOrderIncentivesToman > budget.incentivesPerOrderToman ||
      usage.customerIncentivesToman >
        budget.incentivesPerCustomerPeriodToman - existingCustomerOrderIncentivesToman ||
      usage.periodIncentivesToman > budget.incentivesPerPeriodToman - existingOrderIncentivesToman,
    expiryDays: policy.expiryDays,
  };
}
