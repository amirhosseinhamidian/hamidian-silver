import { getAdminCurrentUser } from '@/lib/auth/session';
import { forwardCatalogMutation } from '@/lib/catalog/catalog-bff';

export async function POST(request: Request, context: { params: Promise<{ mode: string }> }) {
  const { mode } = await context.params;
  if (mode !== 'basket' && mode !== 'history')
    return Response.json({ message: 'Not found.' }, { status: 404 });
  const user = await getAdminCurrentUser();
  if (!user) return Response.json({ message: 'Authentication required.' }, { status: 401 });
  if (!user.permissions.includes('finance.read'))
    return Response.json({ message: 'Required permission is missing.' }, { status: 403 });
  const response = await forwardCatalogMutation(
    request,
    '/api/v1/reward-policies/policy-simulator/' + mode,
    'POST',
  );
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}
