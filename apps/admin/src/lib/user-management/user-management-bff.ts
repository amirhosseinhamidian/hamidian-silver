import 'server-only';

import { cookies } from 'next/headers';

import { SESSION_COOKIE_NAME } from '@/lib/auth/session-cookie';
import { requestAdminCatalog, readJsonResponse } from '@/lib/catalog/catalog-api';

export async function forwardUserManagementMutation(
  request: Request,
  path: string,
  method: 'PATCH' | 'PUT' | 'POST',
): Promise<Response> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) return Response.json({ message: 'Authentication required.' }, { status: 401 });
  try {
    const body = method === 'POST' ? undefined : await request.text();
    const response = await requestAdminCatalog(path, token, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body,
    });
    return Response.json((await readJsonResponse(response)) ?? null, { status: response.status });
  } catch {
    return Response.json({ message: 'User management service is unavailable.' }, { status: 502 });
  }
}
