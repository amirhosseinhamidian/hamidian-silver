import 'server-only';

import { cookies } from 'next/headers';

import { SESSION_COOKIE_NAME } from '@/lib/auth/session-cookie';
import { requestAdminCatalog, readJsonResponse } from '@/lib/catalog/catalog-api';

export async function forwardPlatingMutation(
  request: Request,
  apiPath: string,
  method: 'PATCH' | 'PUT',
): Promise<Response> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) return Response.json({ message: 'Authentication required.' }, { status: 401 });
  try {
    const response = await requestAdminCatalog(apiPath, token, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: await request.text(),
    });
    return Response.json((await readJsonResponse(response)) ?? null, { status: response.status });
  } catch {
    return Response.json({ message: 'Plating service is unavailable.' }, { status: 502 });
  }
}
