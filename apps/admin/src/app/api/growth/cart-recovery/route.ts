import { cookies } from 'next/headers';
import { getAdminCurrentUser } from '@/lib/auth/session';
import { SESSION_COOKIE_NAME } from '@/lib/auth/session-cookie';
import { requestAdminCatalog, readJsonResponse } from '@/lib/catalog/catalog-api';

const headers = { 'Cache-Control': 'private, no-store' };

async function forward(
  request: Request,
  permission: 'finance.read' | 'settings.write',
  path: string,
) {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) return Response.json(null, { status: 401, headers });
  const user = await getAdminCurrentUser();
  if (!user) return Response.json(null, { status: 401, headers });
  if (!user.permissions.includes(permission)) return Response.json(null, { status: 403, headers });
  const mutation = request.method === 'PATCH';
  if (mutation && !request.headers.get('content-type')?.startsWith('application/json'))
    return Response.json(null, { status: 415, headers });
  try {
    const response = await requestAdminCatalog(`/api/v1/cart-recovery/admin/${path}`, token, {
      method: request.method,
      ...(mutation
        ? { headers: { 'Content-Type': 'application/json' }, body: await request.text() }
        : {}),
      signal: request.signal,
    });
    return Response.json(await readJsonResponse(response), { status: response.status, headers });
  } catch {
    return Response.json(null, { status: 502, headers });
  }
}

export function GET(request: Request) {
  return forward(request, 'finance.read', 'report');
}

export function PATCH(request: Request) {
  return forward(request, 'settings.write', 'policy');
}
