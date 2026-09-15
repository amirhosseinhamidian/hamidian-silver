import { forwardCatalogMutation } from '@/lib/catalog/catalog-bff';

type ProductVariantsRouteContext = Readonly<{ params: Promise<{ productId: string }> }>;

export async function POST(request: Request, { params }: ProductVariantsRouteContext) {
  const { productId } = await params;
  return forwardCatalogMutation(
    request,
    `/api/v1/catalog/products/${encodeURIComponent(productId)}/variants`,
    'POST',
  );
}
