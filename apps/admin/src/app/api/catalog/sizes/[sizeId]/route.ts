import { forwardCatalogMutation } from '@/lib/catalog/catalog-bff';

type SizeRouteContext = Readonly<{ params: Promise<{ sizeId: string }> }>;

export async function PATCH(request: Request, { params }: SizeRouteContext) {
  const { sizeId } = await params;
  return forwardCatalogMutation(
    request,
    `/api/v1/catalog/sizes/${encodeURIComponent(sizeId)}`,
    'PATCH',
  );
}
