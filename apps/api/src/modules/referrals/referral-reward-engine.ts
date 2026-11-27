import { isNonNegativeTomanInt } from '../../common/toman';
import { percentage } from '../reward-policies/reward-policy-engine';
import {
  referralRecipients,
  type ReferralRecipient,
  type ReferralRewardDefinitionDto,
  type ReferralRewardPreviewDto,
  type ReferralRewardPreviewLineDto,
  type ReferralRewardRuleDto,
  type ReferralRewardSampleDto,
} from './dto/referral-reward-policy.dto';

const basisPointsPerUnit = 10_000;
export class ReferralRewardPolicyError extends Error {}

export function validateReferralRewardPolicy(definition: ReferralRewardDefinitionDto) {
  const codes = new Set<string>();
  for (const rule of definition.rules) {
    if (codes.has(rule.code))
      throw new ReferralRewardPolicyError(`کد قانون ${rule.code} تکراری است.`);
    codes.add(rule.code);
    if (rule.maximumExclusiveToman != null && rule.maximumExclusiveToman <= rule.minimumToman) {
      throw new ReferralRewardPolicyError(
        `مرز بالای قانون ${rule.code} باید از حداقل مبلغ بیشتر باشد.`,
      );
    }
    if (rule.method === 'PERCENT' && rule.value > basisPointsPerUnit) {
      throw new ReferralRewardPolicyError(`نرخ قانون ${rule.code} باید حداکثر ۱۰۰ درصد باشد.`);
    }
    if (rule.startsAt && rule.endsAt && Date.parse(rule.endsAt) <= Date.parse(rule.startsAt)) {
      throw new ReferralRewardPolicyError(`پایان قانون ${rule.code} باید بعد از زمان شروع باشد.`);
    }
    if (!rule.allowCampaign && rule.campaignIds.length) {
      throw new ReferralRewardPolicyError(
        `برای محدود کردن قانون ${rule.code} به کمپین‌های مشخص، ترکیب با کمپین را فعال کنید.`,
      );
    }
  }
  if (definition.enabled && !definition.rules.some(({ enabled }) => enabled)) {
    throw new ReferralRewardPolicyError('برای فعال کردن برنامه دست‌کم یک قانون فعال تعریف کنید.');
  }
}

function candidate(rule: ReferralRewardRuleDto, sample: ReferralRewardSampleDto, now: number) {
  const rank =
    sample.purchaseRank === 1 ? 'FIRST' : sample.purchaseRank === 2 ? 'SECOND' : 'THIRD_OR_LATER';
  const campaignId = sample.campaignId?.toLowerCase();
  if (
    !rule.enabled ||
    (rule.purchaseRank !== 'ANY' && rule.purchaseRank !== rank) ||
    (rule.startsAt && Date.parse(rule.startsAt) > now) ||
    (rule.endsAt && Date.parse(rule.endsAt) <= now) ||
    (sample.couponApplied && !rule.allowCoupon) ||
    (sample.purchaseRewardApplied && !rule.allowPurchaseReward) ||
    (campaignId && !rule.allowCampaign) ||
    (rule.campaignIds.length && !rule.campaignIds.some((id) => id.toLowerCase() === campaignId))
  )
    return null;

  const scope = new Set(rule.allowedCategoryIds.map((id) => id.toLowerCase()));
  const eligibleToman = sample.lines.reduce(
    (sum, line) =>
      !scope.size || line.categoryIds.some((id) => scope.has(id.toLowerCase()))
        ? sum + line.eligibleToman
        : sum,
    0,
  );
  if (
    !eligibleToman ||
    eligibleToman < rule.minimumToman ||
    eligibleToman >= (rule.maximumExclusiveToman ?? Infinity)
  )
    return null;
  return { rule, eligibleToman };
}

function empty(
  recipient: ReferralRecipient,
  reason: ReferralRewardPreviewLineDto['reason'],
): ReferralRewardPreviewLineDto {
  return { recipient, reason, ruleCode: null, eligibleToman: 0, amountToman: 0, expiryDays: null };
}

export function evaluateReferralRewards(
  definition: ReferralRewardDefinitionDto,
  sample: ReferralRewardSampleDto,
): ReferralRewardPreviewDto {
  validateReferralRewardPolicy(definition);
  const eligibleTotal = sample.lines.reduce((sum, line) => sum + line.eligibleToman, 0);
  if (!isNonNegativeTomanInt(eligibleTotal))
    throw new ReferralRewardPolicyError('مجموع مبلغ نمونه از محدودهٔ معتبر سفارش خارج است.');
  const now = Date.parse(sample.occurredAt);
  if (!Number.isFinite(now))
    throw new ReferralRewardPolicyError('زمان معتبر برای پرداخت نمونه وارد کنید.');
  const usage = new Map(sample.usage.map((row) => [row.ruleCode, row]));
  if (
    sample.usage.some((row) => !definition.rules.some(({ code }) => code === row.ruleCode)) ||
    sample.usage.reduce((sum, row) => sum + BigInt(row.committedToman), 0n) >
      BigInt(sample.programCommittedToman)
  ) {
    throw new ReferralRewardPolicyError('تعهد هر قانون باید در مجموع تعهد قبلی برنامه لحاظ شود.');
  }
  if (!definition.enabled || !sample.confirmed) {
    return {
      recipients: referralRecipients.map((recipient) =>
        empty(recipient, definition.enabled ? 'UNCONFIRMED' : 'PROGRAM_DISABLED'),
      ),
      totalToman: 0,
    };
  }

  const matches = definition.rules
    .map((rule) => candidate(rule, sample, now))
    .filter((match) => match !== null)
    .sort(
      (left, right) =>
        right.rule.priority - left.rule.priority ||
        left.rule.code.localeCompare(right.rule.code, 'en'),
    );
  let remaining = Math.max(
    0,
    Math.min(
      definition.periodBudgetToman - sample.programCommittedToman,
      sample.remainingIncentiveToman,
    ),
  );
  const recipients = new Map(
    referralRecipients.map((recipient) => [recipient, empty(recipient, 'NO_MATCH')]),
  );
  for (const { rule, eligibleToman } of matches) {
    if (recipients.get(rule.recipient)?.ruleCode) continue;
    const used = usage.get(rule.code);
    const beforeCaps = rule.method === 'FIXED' ? rule.value : percentage(eligibleToman, rule.value);
    const useLimit = (used?.recipientUses ?? 0) >= rule.maxUsesPerRecipient;
    const budget = Math.max(
      0,
      Math.min(remaining, rule.periodBudgetToman - (used?.committedToman ?? 0)),
    );
    const amountToman = useLimit ? 0 : Math.min(budget, beforeCaps, rule.capToman);
    recipients.set(rule.recipient, {
      recipient: rule.recipient,
      ruleCode: rule.code,
      eligibleToman,
      amountToman,
      expiryDays: amountToman ? rule.expiryDays : null,
      reason: amountToman
        ? 'AWARDED'
        : useLimit
          ? 'USE_LIMIT'
          : !budget
            ? 'BUDGET_LIMIT'
            : 'VALUE_LIMIT',
    });
    remaining -= amountToman;
  }
  const rows = Array.from(recipients.values());
  return { recipients: rows, totalToman: rows.reduce((sum, row) => sum + row.amountToman, 0) };
}
