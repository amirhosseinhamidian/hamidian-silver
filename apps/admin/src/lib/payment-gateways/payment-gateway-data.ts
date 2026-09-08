import 'server-only';

import { cookies } from 'next/headers';

import { SESSION_COOKIE_NAME } from '@/lib/auth/session-cookie';
import { requestAdminCatalog, readJsonResponse } from '@/lib/catalog/catalog-api';
import {
  parsePaymentGatewaySettings,
  type AdminPaymentGatewaySetting,
} from '@/lib/payment-gateways/payment-gateway-model';

export type PaymentGatewaySettingsData = Readonly<{
  settings: readonly AdminPaymentGatewaySetting[] | null;
  failed: boolean;
}>;

export async function loadPaymentGatewaySettings(): Promise<PaymentGatewaySettingsData> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) throw new Error('Authenticated admin session is required.');

  try {
    const response = await requestAdminCatalog('/api/v1/payments/settings/gateways', token);
    if (!response.ok) return { settings: null, failed: true };
    const settings = parsePaymentGatewaySettings(await readJsonResponse(response));
    return { settings, failed: settings === null };
  } catch {
    return { settings: null, failed: true };
  }
}
