import { getAdminCurrentUser } from '@/lib/auth/session';
import { forwardCatalogMutation } from '@/lib/catalog/catalog-bff';

export async function PATCH(request: Request) {
  const user = await getAdminCurrentUser();
  if (!user) return Response.json({ message: 'Authentication required.' }, { status: 401 });
  if (!user.permissions.includes('finance.read') || !user.permissions.includes('finance.write'))
    return Response.json({ message: 'Required permission is missing.' }, { status: 403 });
  const response = await forwardCatalogMutation(
    request,
    '/api/v1/wallet/admin/credit-issuance',
    'PATCH',
  );
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}
