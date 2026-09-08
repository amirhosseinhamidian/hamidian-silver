import 'server-only';

import { cookies } from 'next/headers';
import { SESSION_COOKIE_NAME } from '@/lib/auth/session-cookie';
import { requestAdminCatalog, readJsonResponse } from '@/lib/catalog/catalog-api';

const ALLOWED_QUERY_KEYS = ['page', 'pageSize', 'q', 'provider', 'status'] as const;

export async function forwardPaymentTransactions(request: Request): Promise<Response> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) return Response.json({ message: 'Authentication required.' }, { status: 401 });

  const incoming = new URL(request.url).searchParams;
  const outgoing = new URLSearchParams();
  for (const key of ALLOWED_QUERY_KEYS) {
    const value = incoming.get(key);
    if (value) outgoing.set(key, value);
  }

  try {
    const suffix = outgoing.size ? `?${outgoing.toString()}` : '';
    const response = await requestAdminCatalog(`/api/v1/payments/attempts${suffix}`, token);
    return Response.json((await readJsonResponse(response)) ?? null, { status: response.status });
  } catch {
    return Response.json(
      { message: 'Payment transaction service is unavailable.' },
      { status: 502 },
    );
  }
}
