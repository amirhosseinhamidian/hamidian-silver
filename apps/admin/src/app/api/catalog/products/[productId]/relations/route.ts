import { forwardCatalogMutation } from '@/lib/catalog/catalog-bff';

type ProductRelationsRouteContext = Readonly<{ params: Promise<{ productId: string }> }>;

export async function PATCH(request: Request, { params }: ProductRelationsRouteContext) {
  const { productId } = await params;
  return forwardCatalogMutation(
    request,
    `/api/v1/catalog/products/${encodeURIComponent(productId)}/relations`,
    'PATCH',
  );
}
