import { forwardCatalogMutation, forwardCatalogUpload } from '@/lib/catalog/catalog-bff';

type BrandImageRouteContext = Readonly<{ params: Promise<{ brandId: string }> }>;

function imagePath(brandId: string): string {
  return `/api/v1/catalog/brands/${encodeURIComponent(brandId)}/image`;
}

export async function POST(request: Request, { params }: BrandImageRouteContext) {
  const { brandId } = await params;
  return forwardCatalogUpload(request, imagePath(brandId));
}

export async function DELETE(request: Request, { params }: BrandImageRouteContext) {
  const { brandId } = await params;
  return forwardCatalogMutation(request, imagePath(brandId), 'DELETE');
}
