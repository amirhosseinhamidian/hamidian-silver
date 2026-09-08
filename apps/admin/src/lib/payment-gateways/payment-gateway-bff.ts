import 'server-only';

import { cookies } from 'next/headers';

import { SESSION_COOKIE_NAME } from '@/lib/auth/session-cookie';
import { requestAdminCatalog, readJsonResponse } from '@/lib/catalog/catalog-api';
import { isAdminPaymentGatewayProvider } from '@/lib/payment-gateways/payment-gateway-model';

export async function forwardPaymentGatewayUpdate(
  request: Request,
  provider: string,
): Promise<Response> {
  if (!isAdminPaymentGatewayProvider(provider)) {
    return Response.json({ message: 'Unknown payment gateway.' }, { status: 400 });
  }

  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) return Response.json({ message: 'Authentication required.' }, { status: 401 });

  try {
    const response = await requestAdminCatalog(
      `/api/v1/payments/settings/gateways/${provider}`,
      token,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: await request.text(),
      },
    );
    return Response.json((await readJsonResponse(response)) ?? null, { status: response.status });
  } catch {
    return Response.json({ message: 'Payment gateway service is unavailable.' }, { status: 502 });
  }
}
