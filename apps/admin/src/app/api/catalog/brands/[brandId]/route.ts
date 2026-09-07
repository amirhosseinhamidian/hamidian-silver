import { forwardCatalogMutation } from '@/lib/catalog/catalog-bff';

type BrandRouteContext = Readonly<{ params: Promise<{ brandId: string }> }>;

function brandPath(brandId: string): string {
  return `/api/v1/catalog/brands/${encodeURIComponent(brandId)}`;
}

export async function PATCH(request: Request, { params }: BrandRouteContext) {
  const { brandId } = await params;
  return forwardCatalogMutation(request, brandPath(brandId), 'PATCH');
}

export async function DELETE(request: Request, { params }: BrandRouteContext) {
  const { brandId } = await params;
  return forwardCatalogMutation(request, brandPath(brandId), 'DELETE');
}
