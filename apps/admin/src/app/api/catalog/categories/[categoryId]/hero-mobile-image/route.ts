import { forwardCatalogMutation, forwardCatalogUpload } from '@/lib/catalog/catalog-bff';

type CategoryMobileHeroRouteContext = Readonly<{ params: Promise<{ categoryId: string }> }>;

function categoryMobileHeroPath(categoryId: string): string {
  return `/api/v1/catalog/categories/${encodeURIComponent(categoryId)}/hero-mobile-image`;
}

export async function POST(request: Request, { params }: CategoryMobileHeroRouteContext) {
  const { categoryId } = await params;
  return forwardCatalogUpload(request, categoryMobileHeroPath(categoryId));
}

export async function DELETE(request: Request, { params }: CategoryMobileHeroRouteContext) {
  const { categoryId } = await params;
  return forwardCatalogMutation(request, categoryMobileHeroPath(categoryId), 'DELETE');
}
