import { forwardCatalogMutation } from '@/lib/catalog/catalog-bff';

export async function PATCH(
  request: Request,
  context: { params: Promise<{ productId: string; code: string }> },
) {
  const { productId, code } = await context.params;
  return forwardCatalogMutation(
    request,
    `/api/v1/catalog/products/${encodeURIComponent(productId)}/typed-attributes/${encodeURIComponent(code)}`,
    'PATCH',
  );
}
