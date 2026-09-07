import { forwardCatalogMutation } from '@/lib/catalog/catalog-bff';

type ProductRouteContext = Readonly<{ params: Promise<{ productId: string }> }>;

export async function PATCH(request: Request, { params }: ProductRouteContext) {
  const { productId } = await params;
  return forwardCatalogMutation(
    request,
    `/api/v1/catalog/products/${encodeURIComponent(productId)}`,
    'PATCH',
  );
}
