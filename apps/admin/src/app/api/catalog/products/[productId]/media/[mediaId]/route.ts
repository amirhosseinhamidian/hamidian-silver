import { forwardCatalogMutation } from '@/lib/catalog/catalog-bff';

type ProductMediaItemRouteContext = Readonly<{
  params: Promise<{ productId: string; mediaId: string }>;
}>;

function productMediaPath(productId: string, mediaId: string): string {
  return `/api/v1/catalog/products/${encodeURIComponent(productId)}/media/${encodeURIComponent(mediaId)}`;
}

export async function PATCH(request: Request, { params }: ProductMediaItemRouteContext) {
  const { productId, mediaId } = await params;
  return forwardCatalogMutation(request, productMediaPath(productId, mediaId), 'PATCH');
}

export async function DELETE(request: Request, { params }: ProductMediaItemRouteContext) {
  const { productId, mediaId } = await params;
  return forwardCatalogMutation(request, productMediaPath(productId, mediaId), 'DELETE');
}
