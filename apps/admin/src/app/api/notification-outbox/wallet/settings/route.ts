import { cookies } from 'next/headers';
import { SESSION_COOKIE_NAME } from '@/lib/auth/session-cookie';
import { readJsonResponse, requestAdminCatalog } from '@/lib/catalog/catalog-api';

export async function PATCH(request: Request) {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) return Response.json(null, { status: 401 });
  if (!request.headers.get('content-type')?.startsWith('application/json')) {
    return Response.json(null, { status: 415 });
  }
  try {
    const response = await requestAdminCatalog('/api/v1/notifications/wallet/settings', token, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: await request.text(),
    });
    return Response.json((await readJsonResponse(response)) ?? null, {
      status: response.status,
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch {
    return Response.json(null, { status: 502 });
  }
}
