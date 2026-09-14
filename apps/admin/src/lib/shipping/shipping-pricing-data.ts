import 'server-only';

import { cookies } from 'next/headers';
import { SESSION_COOKIE_NAME } from '@/lib/auth/session-cookie';
import { requestAdminCatalog, readJsonResponse } from '@/lib/catalog/catalog-api';
import {
  parseAdminShippingPricingSettings,
  type AdminShippingPricingSettings,
} from '@/lib/shipping/shipping-pricing-model';

export type ShippingPricingData = Readonly<{
  settings: AdminShippingPricingSettings | null;
  failed: boolean;
}>;

export async function loadShippingPricingData(): Promise<ShippingPricingData> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) throw new Error('Authenticated admin session is required.');
  try {
    const response = await requestAdminCatalog('/api/v1/shipping/pricing', token);
    if (!response.ok) return { settings: null, failed: true };
    const settings = parseAdminShippingPricingSettings(await readJsonResponse(response));
    return { settings, failed: settings === null };
  } catch {
    return { settings: null, failed: true };
  }
}
