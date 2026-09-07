import { forwardCatalogMutation } from '@/lib/catalog/catalog-bff';

type ProductVariantRouteContext = Readonly<{
  params: Promise<{ productId: string; variantId: string }>;
}>;

export async function PATCH(request: Request, { params }: ProductVariantRouteContext) {
  const { productId, variantId } = await params;
  return forwardCatalogMutation(
    request,
    `/api/v1/catalog/products/${encodeURIComponent(productId)}/variants/${encodeURIComponent(variantId)}`,
    'PATCH',
  );
}
