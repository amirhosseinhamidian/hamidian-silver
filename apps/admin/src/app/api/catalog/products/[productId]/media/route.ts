import { forwardCatalogMutation, forwardCatalogUpload } from '@/lib/catalog/catalog-bff';

type ProductMediaRouteContext = Readonly<{ params: Promise<{ productId: string }> }>;

export async function POST(request: Request, { params }: ProductMediaRouteContext) {
  const { productId } = await params;
  return forwardCatalogUpload(
    request,
    `/api/v1/catalog/products/${encodeURIComponent(productId)}/media`,
  );
}

export async function PATCH(request: Request, { params }: ProductMediaRouteContext) {
  const { productId } = await params;
  return forwardCatalogMutation(
    request,
    `/api/v1/catalog/products/${encodeURIComponent(productId)}/media/order`,
    'PATCH',
  );
}
