import 'server-only';

import { cookies } from 'next/headers';
import { SESSION_COOKIE_NAME } from '@/lib/auth/session-cookie';
import { requestAdminCatalog, readJsonResponse } from '@/lib/catalog/catalog-api';

async function upstream(response: Response): Promise<Response> {
  if (response.status === 204) return new Response(null, { status: 204 });
  return Response.json((await readJsonResponse(response)) ?? null, { status: response.status });
}

export async function forwardGuideRequest(
  request: Request,
  apiPath: string,
  method: 'POST' | 'PATCH' | 'DELETE',
): Promise<Response> {
  const accessToken = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!accessToken) return Response.json({ message: 'Authentication required.' }, { status: 401 });
  try {
    const body = method === 'DELETE' ? undefined : await request.text();
    const response = await requestAdminCatalog(apiPath, accessToken, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body,
    });
    return upstream(response);
  } catch {
    return Response.json({ message: 'Guide service is unavailable.' }, { status: 502 });
  }
}
