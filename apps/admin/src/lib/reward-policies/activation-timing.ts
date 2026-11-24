export type RewardActivationTiming = Readonly<{
  policyVersion: number | null;
  activationDelayDays: number;
}>;

export function parseRewardActivationTiming(value: unknown): RewardActivationTiming | null {
  if (!value || typeof value !== 'object') return null;
  const { policyVersion, activationDelayDays } = value as Record<string, unknown>;
  if (
    policyVersion !== null &&
    (typeof policyVersion !== 'number' || !Number.isSafeInteger(policyVersion) || policyVersion < 1)
  ) {
    return null;
  }
  if (
    typeof activationDelayDays !== 'number' ||
    !Number.isSafeInteger(activationDelayDays) ||
    activationDelayDays < 0
  ) {
    return null;
  }
  return { policyVersion, activationDelayDays };
}
