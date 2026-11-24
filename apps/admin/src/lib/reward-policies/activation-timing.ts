export type RewardActivationTiming = Readonly<{
  policyVersion: number | null;
  activationDelayDays: number;
  expiryDays: number;
}>;

export function parseRewardActivationTiming(value: unknown): RewardActivationTiming | null {
  if (!value || typeof value !== 'object') return null;
  const { policyVersion, activationDelayDays, expiryDays } = value as Record<string, unknown>;
  if (
    policyVersion !== null &&
    (typeof policyVersion !== 'number' || !Number.isSafeInteger(policyVersion) || policyVersion < 1)
  ) {
    return null;
  }
  if (
    typeof activationDelayDays !== 'number' ||
    !Number.isSafeInteger(activationDelayDays) ||
    activationDelayDays < 0 ||
    typeof expiryDays !== 'number' ||
    !Number.isSafeInteger(expiryDays) ||
    expiryDays < 1 ||
    expiryDays > 3_650
  ) {
    return null;
  }
  return { policyVersion, activationDelayDays, expiryDays };
}
