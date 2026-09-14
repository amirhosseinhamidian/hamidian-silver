export type ShippingPricingMode = 'FREE' | 'FIXED';

export type AdminShippingPricingSettings = Readonly<{
  mode: ShippingPricingMode;
  baseCostToman: number;
  thresholdToman: number | null;
  discountedCostToman: number | null;
  source: 'DATABASE' | 'ENVIRONMENT';
  updatedAt: string | null;
}>;

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function nonNegativeInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

export function parseAdminShippingPricingSettings(
  value: unknown,
): AdminShippingPricingSettings | null {
  const source = record(value);
  if (!source) return null;
  const mode = source.mode === 'FREE' || source.mode === 'FIXED' ? source.mode : null;
  const baseCostToman = nonNegativeInteger(source.baseCostToman);
  const thresholdToman =
    source.thresholdToman === null ? null : nonNegativeInteger(source.thresholdToman);
  const discountedCostToman =
    source.discountedCostToman === null ? null : nonNegativeInteger(source.discountedCostToman);
  const settingsSource =
    source.source === 'DATABASE' || source.source === 'ENVIRONMENT' ? source.source : null;
  const updatedAt =
    source.updatedAt === null || typeof source.updatedAt === 'string'
      ? source.updatedAt
      : undefined;

  if (
    !mode ||
    baseCostToman === null ||
    (thresholdToman === null) !== (source.thresholdToman === null) ||
    (discountedCostToman === null) !== (source.discountedCostToman === null) ||
    !settingsSource ||
    updatedAt === undefined
  )
    return null;

  const hasThreshold = thresholdToman !== null || discountedCostToman !== null;
  if (
    (mode === 'FREE' && (baseCostToman !== 0 || hasThreshold)) ||
    (mode === 'FIXED' && baseCostToman <= 0) ||
    (hasThreshold &&
      (thresholdToman === null ||
        thresholdToman <= 0 ||
        discountedCostToman === null ||
        discountedCostToman >= baseCostToman))
  )
    return null;

  return {
    mode,
    baseCostToman,
    thresholdToman,
    discountedCostToman,
    source: settingsSource,
    updatedAt,
  };
}
