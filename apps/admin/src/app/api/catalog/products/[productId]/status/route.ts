import { forwardCatalogMutation } from '@/lib/catalog/catalog-bff';

type ProductStatusRouteContext = Readonly<{ params: Promise<{ productId: string }> }>;

export async function PATCH(request: Request, { params }: ProductStatusRouteContext) {
  const { productId } = await params;
  return forwardCatalogMutation(
    request,
    `/api/v1/catalog/products/${encodeURIComponent(productId)}/status`,
    'PATCH',
  );
}
