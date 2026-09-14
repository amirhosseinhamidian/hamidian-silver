import { forwardCatalogMutation, forwardCatalogUpload } from '@/lib/catalog/catalog-bff';

type BrandMobileHeroRouteContext = Readonly<{ params: Promise<{ brandId: string }> }>;

function brandMobileHeroPath(brandId: string): string {
  return `/api/v1/catalog/brands/${encodeURIComponent(brandId)}/hero-mobile-image`;
}

export async function POST(request: Request, { params }: BrandMobileHeroRouteContext) {
  const { brandId } = await params;
  return forwardCatalogUpload(request, brandMobileHeroPath(brandId));
}

export async function DELETE(request: Request, { params }: BrandMobileHeroRouteContext) {
  const { brandId } = await params;
  return forwardCatalogMutation(request, brandMobileHeroPath(brandId), 'DELETE');
}
