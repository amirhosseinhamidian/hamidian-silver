import { getAdminCurrentUser } from '@/lib/auth/session';
import { forwardSiteSettingsJson } from '@/lib/site-settings/site-settings-bff';

export async function POST(request: Request) {
  const headers = { 'Cache-Control': 'private, no-store' };
  const user = await getAdminCurrentUser();
  if (!user) return Response.json(null, { status: 401, headers });
  if (!user.permissions.includes('finance.read'))
    return Response.json(null, { status: 403, headers });
  const response = await forwardSiteSettingsJson(
    request,
    '/api/v1/wallet/admin/customers/search',
    'POST',
  );
  response.headers.set('Cache-Control', headers['Cache-Control']);
  return response;
}
