import { forwardCatalogMutation, forwardCatalogUpload } from '@/lib/catalog/catalog-bff';

type CategoryFeaturedImageRouteContext = Readonly<{ params: Promise<{ categoryId: string }> }>;

function categoryFeaturedImagePath(categoryId: string): string {
  return `/api/v1/catalog/categories/${encodeURIComponent(categoryId)}/featured-image`;
}

export async function POST(request: Request, { params }: CategoryFeaturedImageRouteContext) {
  const { categoryId } = await params;
  return forwardCatalogUpload(request, categoryFeaturedImagePath(categoryId));
}

export async function DELETE(request: Request, { params }: CategoryFeaturedImageRouteContext) {
  const { categoryId } = await params;
  return forwardCatalogMutation(request, categoryFeaturedImagePath(categoryId), 'DELETE');
}
