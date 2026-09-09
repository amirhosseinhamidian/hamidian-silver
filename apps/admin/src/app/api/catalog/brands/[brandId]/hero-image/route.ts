import { forwardCatalogMutation, forwardCatalogUpload } from '@/lib/catalog/catalog-bff';

type BrandHeroRouteContext = Readonly<{ params: Promise<{ brandId: string }> }>;

function heroPath(brandId: string): string {
  return `/api/v1/catalog/brands/${encodeURIComponent(brandId)}/hero-image`;
}

export async function POST(request: Request, { params }: BrandHeroRouteContext) {
  const { brandId } = await params;
  return forwardCatalogUpload(request, heroPath(brandId));
}

export async function DELETE(request: Request, { params }: BrandHeroRouteContext) {
  const { brandId } = await params;
  return forwardCatalogMutation(request, heroPath(brandId), 'DELETE');
}
