import 'server-only';

import { cookies } from 'next/headers';

import { SESSION_COOKIE_NAME } from '@/lib/auth/session-cookie';
import { requestAdminCatalog, readJsonResponse } from '@/lib/catalog/catalog-api';

export async function forwardPricingMutation(request: Request, apiPath: string): Promise<Response> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) return Response.json({ message: 'Authentication required.' }, { status: 401 });
  try {
    const response = await requestAdminCatalog(apiPath, token, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: await request.text(),
    });
    return Response.json((await readJsonResponse(response)) ?? null, { status: response.status });
  } catch {
    return Response.json({ message: 'Pricing service is unavailable.' }, { status: 502 });
  }
}
