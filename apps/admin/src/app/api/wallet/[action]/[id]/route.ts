import { getAdminCurrentUser } from '@/lib/auth/session';
import { forwardCatalogMutation } from '@/lib/catalog/catalog-bff';
import { walletUuid } from '@/lib/reward-policies/wallet-operations';

type Context = { params: Promise<{ action: string; id: string }> };

async function forward(request: Request, context: Context) {
  const { id, action } = await context.params;
  if (!walletUuid.test(id)) return Response.json(null, { status: 400 });
  const user = await getAdminCurrentUser();
  if (!user) return Response.json(null, { status: 401 });
  if (!user.permissions.includes('finance.read') || !user.permissions.includes('finance.write')) {
    return Response.json(null, { status: 403 });
  }

  const jobs = '/api/v1/wallet/admin/purchase-reward-jobs';
  if (action === 'corrections' && request.method === 'POST') {
    return forwardCatalogMutation(request, `/api/v1/wallet/admin/${id}/corrections`, 'POST');
  }
  if (action === 'review-hold' && request.method === 'PATCH') {
    return forwardCatalogMutation(request, `${jobs}/${id}/review-hold`, 'PATCH');
  }
  if (action === 'retry' && request.method === 'POST') {
    return forwardCatalogMutation(request, `${jobs}/${id}/retry`, 'POST');
  }
  return Response.json(null, { status: 404 });
}

export const POST = forward;
export const PATCH = forward;
