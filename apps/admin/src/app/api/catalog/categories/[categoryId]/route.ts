import { forwardCatalogMutation } from '@/lib/catalog/catalog-bff';

type CategoryRouteContext = Readonly<{ params: Promise<{ categoryId: string }> }>;

export async function PATCH(request: Request, { params }: CategoryRouteContext) {
  const { categoryId } = await params;
  return forwardCatalogMutation(
    request,
    `/api/v1/catalog/categories/${encodeURIComponent(categoryId)}`,
    'PATCH',
  );
}

export async function DELETE(request: Request, { params }: CategoryRouteContext) {
  const { categoryId } = await params;
  return forwardCatalogMutation(
    request,
    `/api/v1/catalog/categories/${encodeURIComponent(categoryId)}`,
    'DELETE',
  );
}
