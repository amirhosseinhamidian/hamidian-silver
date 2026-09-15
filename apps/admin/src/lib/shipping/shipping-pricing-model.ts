import type { SiteMedia } from '@/lib/site-settings/site-settings-model';

export type ShippingPricingMode = 'FREE' | 'FIXED';

export type AdminShippingCarrier = Readonly<{
  id: string;
  name: string;
  trackingUrl: string | null;
  logoMediaId: string | null;
  logo: SiteMedia | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}>;

export type AdminShippingPricingSettings = Readonly<{
  mode: ShippingPricingMode;
  baseCostToman: number;
  thresholdToman: number | null;
  discountedCostToman: number | null;
  carrierName: string | null;
  carrierTrackingUrl: string | null;
  carrierLogoMediaId: string | null;
  carrierLogo: SiteMedia | null;
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

function nullableText(value: unknown): string | null | undefined {
  return value === null ? null : typeof value === 'string' ? value.trim() || null : undefined;
}

function media(value: unknown): SiteMedia | null | undefined {
  if (value === null) return null;
  const source = record(value);
  const id = source && typeof source.id === 'string' ? source.id : null;
  const mimeType = source && typeof source.mimeType === 'string' ? source.mimeType : null;
  const url = source ? nullableText(source.url) : undefined;
  const altText = source ? nullableText(source.altText) : undefined;
  return id && mimeType && url !== undefined && altText !== undefined
    ? { id, mimeType, url, altText }
    : undefined;
}

export function parseAdminShippingCarrier(value: unknown): AdminShippingCarrier | null {
  const source = record(value);
  if (!source) return null;
  const trackingUrl = nullableText(source.trackingUrl);
  const logoMediaId = nullableText(source.logoMediaId);
  const carrierLogo = media(source.logo);
  if (
    typeof source.id !== 'string' ||
    typeof source.name !== 'string' ||
    !source.name.trim() ||
    trackingUrl === undefined ||
    logoMediaId === undefined ||
    carrierLogo === undefined ||
    typeof source.isActive !== 'boolean' ||
    typeof source.createdAt !== 'string' ||
    typeof source.updatedAt !== 'string'
  )
    return null;
  return {
    id: source.id,
    name: source.name.trim(),
    trackingUrl,
    logoMediaId,
    logo: carrierLogo,
    isActive: source.isActive,
    createdAt: source.createdAt,
    updatedAt: source.updatedAt,
  };
}

export function parseAdminShippingCarriers(value: unknown): readonly AdminShippingCarrier[] | null {
  if (!Array.isArray(value)) return null;
  const carriers = value.map(parseAdminShippingCarrier);
  return carriers.some((carrier) => carrier === null) ? null : (carriers as AdminShippingCarrier[]);
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
  const carrierName = nullableText(source.carrierName);
  const carrierTrackingUrl = nullableText(source.carrierTrackingUrl);
  const carrierLogoMediaId = nullableText(source.carrierLogoMediaId);
  const carrierLogo = media(source.carrierLogo);

  if (
    !mode ||
    baseCostToman === null ||
    (thresholdToman === null) !== (source.thresholdToman === null) ||
    (discountedCostToman === null) !== (source.discountedCostToman === null) ||
    !settingsSource ||
    updatedAt === undefined ||
    carrierName === undefined ||
    carrierTrackingUrl === undefined ||
    carrierLogoMediaId === undefined ||
    carrierLogo === undefined
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
    carrierName,
    carrierTrackingUrl,
    carrierLogoMediaId,
    carrierLogo,
    source: settingsSource,
    updatedAt,
  };
}
