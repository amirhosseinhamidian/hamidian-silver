import { cookies } from 'next/headers';
import { getAdminCurrentUser } from '@/lib/auth/session';
import { SESSION_COOKIE_NAME } from '@/lib/auth/session-cookie';
import { readJsonResponse, requestAdminCatalog } from '@/lib/catalog/catalog-api';

export async function GET(request: Request) {
  const headers = { 'Cache-Control': 'private, no-store' };
  const user = await getAdminCurrentUser();
  if (!user) return Response.json(null, { status: 401, headers });
  if (!user.permissions.includes('finance.read'))
    return Response.json(null, { status: 403, headers });
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) return Response.json(null, { status: 401, headers });
  const query = new URL(request.url).searchParams;
  const kind = query.get('kind');
  const q = query.get('q')?.trim();
  if ((kind !== 'category' && kind !== 'campaign') || !q || q.length > 80) {
    return Response.json(null, { status: 400, headers });
  }
  const params = new URLSearchParams({ kind, q });
  try {
    const response = await requestAdminCatalog(
      `/api/v1/referral-reward-policies/scopes?${params}`,
      token,
    );
    return Response.json(await readJsonResponse(response), { status: response.status, headers });
  } catch {
    return Response.json(null, { status: 502, headers });
  }
}
