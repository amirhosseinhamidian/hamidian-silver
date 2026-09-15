import type { components } from '@hamidian/contracts';
import { createServerApiClient } from '@/lib/api/server-client';

export type PublicShippingPricing = components['schemas']['ShippingPricingSettingsDto'];

export function calculatePublicShippingCost(
  policy: PublicShippingPricing,
  cartSubtotalToman: number,
): number {
  if (policy.mode === 'FREE') return 0;
  if (policy.thresholdToman !== null && cartSubtotalToman >= policy.thresholdToman)
    return policy.discountedCostToman ?? policy.baseCostToman;
  return policy.baseCostToman;
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
