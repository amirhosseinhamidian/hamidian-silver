import type { components } from '@hamidian/contracts';
import { createServerApiClient } from '@/lib/api/server-client';

export type PublicShippingPricing = components['schemas']['ShippingPricingSettingsDto'];
export type PublicShippingOption = Readonly<{
  id: string;
  name: string;
  subtitle: string | null;
  logo: Readonly<{ url: string | null; altText: string | null }> | null;
  pricingMode: 'FREE' | 'FIXED' | 'COLLECT';
  baseCostToman: number;
  thresholdToman: number | null;
  discountedCostToman: number | null;
  serviceArea: 'NATIONWIDE' | 'TEHRAN_ONLY';
}>;

export function calculatePublicShippingCost(
  policy: PublicShippingPricing,
  cartSubtotalToman: number,
): number {
  if (policy.mode === 'FREE') return 0;
  if (policy.thresholdToman !== null && cartSubtotalToman >= policy.thresholdToman)
    return policy.discountedCostToman ?? policy.baseCostToman;
  return policy.baseCostToman;
}

export function calculateShippingOptionCost(
  option: PublicShippingOption,
  cartSubtotalToman: number,
): number {
  if (option.pricingMode !== 'FIXED') return 0;
  if (option.thresholdToman !== null && cartSubtotalToman >= option.thresholdToman)
    return option.discountedCostToman ?? option.baseCostToman;
  return option.baseCostToman;
}

export function shippingOptionSupportsDestination(
  option: PublicShippingOption,
  destination: Readonly<{ province: string; city: string }>,
): boolean {
  return (
    option.serviceArea === 'NATIONWIDE' ||
    (destination.province.trim() === 'تهران' && destination.city.trim() === 'تهران')
  );
}

export async function getPublicShippingOptions(): Promise<readonly PublicShippingOption[]> {
  const apiOrigin = process.env.HAMIDIAN_API_ORIGIN;
  if (!apiOrigin) return [];
  try {
    const response = await fetch(`${apiOrigin.replace(/\/$/, '')}/api/v1/shipping/options/public`, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return [];
    const payload: unknown = await response.json();
    return Array.isArray(payload) ? (payload as PublicShippingOption[]) : [];
  } catch {
    return [];
  }
}

export async function getPublicShippingPricing(): Promise<PublicShippingPricing | null> {
  const apiOrigin = process.env.HAMIDIAN_API_ORIGIN;
  if (!apiOrigin) return null;
  try {
    const { data, response } = await createServerApiClient({ apiOrigin }).GET(
      '/api/v1/shipping/pricing/public',
      { cache: 'no-store' },
    );
    return response.ok && data ? data : null;
  } catch {
    return null;
  }
}
