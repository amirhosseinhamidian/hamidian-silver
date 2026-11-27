import { forwardCatalogMutation } from '@/lib/catalog/catalog-bff';

type ProductMerchandisingRouteContext = Readonly<{ params: Promise<{ productId: string }> }>;

export async function PATCH(request: Request, { params }: ProductMerchandisingRouteContext) {
  const { productId } = await params;
  return forwardCatalogMutation(
    request,
    `/api/v1/catalog/products/${encodeURIComponent(productId)}/merchandising`,
    'PATCH',
  );
}
