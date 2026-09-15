import 'server-only';

import { cookies } from 'next/headers';

import { SESSION_COOKIE_NAME } from '@/lib/auth/session-cookie';
import { readJsonResponse, requestAdminCatalog } from '@/lib/catalog/catalog-api';

export async function forwardCardToCardAccountRequest(
  request: Request,
  accountId?: string,
): Promise<Response> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) return Response.json({ message: 'Authentication required.' }, { status: 401 });

  const suffix = accountId ? `/${encodeURIComponent(accountId)}` : '';

  try {
    const response = await requestAdminCatalog(
      `/api/v1/payments/settings/card-to-card/accounts${suffix}`,
      token,
      {
        method: request.method,
        headers: request.method === 'DELETE' ? undefined : { 'Content-Type': 'application/json' },
        body: request.method === 'DELETE' ? undefined : await request.text(),
      },
    );
    return Response.json((await readJsonResponse(response)) ?? null, { status: response.status });
  } catch {
    return Response.json({ message: 'Payment method service is unavailable.' }, { status: 502 });
  }
}
