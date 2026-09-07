import { forwardCatalogMutation, forwardCatalogUpload } from '@/lib/catalog/catalog-bff';

type CategoryImageRouteContext = Readonly<{ params: Promise<{ categoryId: string }> }>;

function categoryImagePath(categoryId: string): string {
  return `/api/v1/catalog/categories/${encodeURIComponent(categoryId)}/image`;
}

export async function POST(request: Request, { params }: CategoryImageRouteContext) {
  const { categoryId } = await params;
  return forwardCatalogUpload(request, categoryImagePath(categoryId));
}

export async function DELETE(request: Request, { params }: CategoryImageRouteContext) {
  const { categoryId } = await params;
  return forwardCatalogMutation(request, categoryImagePath(categoryId), 'DELETE');
}
