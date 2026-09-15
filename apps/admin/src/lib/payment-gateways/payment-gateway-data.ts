import 'server-only';

import { cookies } from 'next/headers';

import { SESSION_COOKIE_NAME } from '@/lib/auth/session-cookie';
import { requestAdminCatalog, readJsonResponse } from '@/lib/catalog/catalog-api';
import {
  parsePaymentGatewaySettings,
  type AdminPaymentGatewaySetting,
} from '@/lib/payment-gateways/payment-gateway-model';
import {
  parseCardToCardAccounts,
  type AdminCardToCardAccount,
} from '@/lib/payment-gateways/card-to-card-account-model';

export type PaymentGatewaySettingsData = Readonly<{
  settings: readonly AdminPaymentGatewaySetting[] | null;
  cardToCardAccounts: readonly AdminCardToCardAccount[] | null;
  failed: boolean;
}>;

export async function loadPaymentGatewaySettings(): Promise<PaymentGatewaySettingsData> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) throw new Error('Authenticated admin session is required.');

  try {
    const [gatewayResponse, cardResponse] = await Promise.all([
      requestAdminCatalog('/api/v1/payments/settings/gateways', token),
      requestAdminCatalog('/api/v1/payments/settings/card-to-card/accounts', token),
    ]);
    if (!gatewayResponse.ok || !cardResponse.ok) {
      return { settings: null, cardToCardAccounts: null, failed: true };
    }
    const settings = parsePaymentGatewaySettings(await readJsonResponse(gatewayResponse));
    const cardToCardAccounts = parseCardToCardAccounts(await readJsonResponse(cardResponse));
    return {
      settings,
      cardToCardAccounts,
      failed: settings === null || cardToCardAccounts === null,
    };
  } catch {
    return { settings: null, cardToCardAccounts: null, failed: true };
  }
}
