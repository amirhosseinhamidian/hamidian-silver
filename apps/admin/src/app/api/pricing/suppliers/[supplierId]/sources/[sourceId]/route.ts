import { forwardSupplierMutation } from '@/lib/suppliers/suppliers-bff';

type SupplierSourceRouteContext = Readonly<{
  params: Promise<{ supplierId: string; sourceId: string }>;
}>;

export async function PATCH(request: Request, { params }: SupplierSourceRouteContext) {
  const { supplierId, sourceId } = await params;
  return forwardSupplierMutation(
    request,
    `/api/v1/pricing/suppliers/${encodeURIComponent(supplierId)}/sources/${encodeURIComponent(sourceId)}`,
    'PATCH',
  );
}
