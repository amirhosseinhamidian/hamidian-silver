import { forwardCatalogMutation } from '@/lib/catalog/catalog-bff';

type SizeGroupRouteContext = Readonly<{ params: Promise<{ groupId: string }> }>;

export async function PATCH(request: Request, { params }: SizeGroupRouteContext) {
  const { groupId } = await params;
  return forwardCatalogMutation(
    request,
    `/api/v1/catalog/size-groups/${encodeURIComponent(groupId)}`,
    'PATCH',
  );
}
