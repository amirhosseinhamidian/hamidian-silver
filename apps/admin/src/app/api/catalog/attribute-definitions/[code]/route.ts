import { forwardCatalogMutation } from '@/lib/catalog/catalog-bff';

export async function PATCH(request: Request, context: { params: Promise<{ code: string }> }) {
  const { code } = await context.params;
  return forwardCatalogMutation(
    request,
    `/api/v1/catalog/attribute-definitions/${encodeURIComponent(code)}`,
    'PATCH',
  );
}
