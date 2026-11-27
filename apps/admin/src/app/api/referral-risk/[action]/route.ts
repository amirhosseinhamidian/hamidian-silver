import { getAdminCurrentUser } from '@/lib/auth/session';
import { forwardCatalogMutation } from '@/lib/catalog/catalog-bff';
import { caseUuid } from '@/lib/reward-policies/referral-risk';

type Context = { params: Promise<{ action: string }> };

export async function POST(request: Request, context: Context) {
  const { action } = await context.params;
  const id = action.startsWith('review-') ? action.slice(7) : '';
  const root = '/api/v1/referral-risk';
  const path =
    action === 'policies' || action === 'simulation'
      ? `${root}/${action}`
      : caseUuid.test(id)
        ? `${root}/cases/${id}/decisions`
        : null;
  if (!path) return Response.json(null, { status: 404 });
  if (!request.headers.get('content-type')?.startsWith('application/json'))
    return Response.json(null, { status: 415 });
  const user = await getAdminCurrentUser();
  if (!user) return Response.json(null, { status: 401 });
  if (
    !user.permissions.includes('finance.read') ||
    (action !== 'simulation' && !user.permissions.includes('finance.write'))
  ) {
    return Response.json(null, { status: 403 });
  }
  return forwardCatalogMutation(request, path, 'POST');
}
