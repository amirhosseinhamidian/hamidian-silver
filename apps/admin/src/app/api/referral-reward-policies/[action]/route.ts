import { getAdminCurrentUser } from '@/lib/auth/session';
import { forwardCatalogMutation } from '@/lib/catalog/catalog-bff';

type Context = { params: Promise<{ action: string }> };

export async function POST(request: Request, context: Context) {
  const { action } = await context.params;
  const publishVersion = /^publish-([1-9]\d{0,9})$/.exec(action)?.[1];
  const root = '/api/v1/referral-reward-policies';
  const path =
    action === 'draft'
      ? root
      : action === 'simulation'
        ? `${root}/simulation`
        : publishVersion
          ? `${root}/${publishVersion}/publish`
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
