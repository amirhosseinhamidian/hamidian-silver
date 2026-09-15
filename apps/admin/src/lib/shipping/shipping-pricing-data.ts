import 'server-only';

import { cookies } from 'next/headers';
import { SESSION_COOKIE_NAME } from '@/lib/auth/session-cookie';
import { requestAdminCatalog, readJsonResponse } from '@/lib/catalog/catalog-api';
import {
  parseAdminShippingCarriers,
  parseAdminShippingPricingSettings,
  type AdminShippingCarrier,
  type AdminShippingPricingSettings,
} from '@/lib/shipping/shipping-pricing-model';

export type ShippingPricingData = Readonly<{
  settings: AdminShippingPricingSettings | null;
  carriers: readonly AdminShippingCarrier[];
  failed: boolean;
}>;

export async function loadShippingPricingData(): Promise<ShippingPricingData> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) throw new Error('Authenticated admin session is required.');
  try {
    const [settingsResponse, carriersResponse] = await Promise.all([
      requestAdminCatalog('/api/v1/shipping/pricing', token),
      requestAdminCatalog('/api/v1/shipping/carriers', token),
    ]);
    if (!settingsResponse.ok || !carriersResponse.ok)
      return { settings: null, carriers: [], failed: true };
    const settings = parseAdminShippingPricingSettings(await readJsonResponse(settingsResponse));
    const carriers = parseAdminShippingCarriers(await readJsonResponse(carriersResponse));
    return { settings, carriers: carriers ?? [], failed: settings === null || carriers === null };
  } catch {
    return { settings: null, carriers: [], failed: true };
  }
}

export async function loadActiveShippingCarriers(): Promise<readonly AdminShippingCarrier[]> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) throw new Error('Authenticated admin session is required.');
  try {
    const response = await requestAdminCatalog('/api/v1/shipping/carriers/active', token);
    if (!response.ok) return [];
    return parseAdminShippingCarriers(await readJsonResponse(response)) ?? [];
  } catch {
    return [];
  }
}
