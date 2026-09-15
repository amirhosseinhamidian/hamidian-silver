import { forwardSupplierMutation } from '@/lib/suppliers/suppliers-bff';

type SupplierRouteContext = Readonly<{ params: Promise<{ supplierId: string }> }>;

export async function PATCH(request: Request, { params }: SupplierRouteContext) {
  const { supplierId } = await params;
  return forwardSupplierMutation(
    request,
    `/api/v1/pricing/suppliers/${encodeURIComponent(supplierId)}`,
    'PATCH',
  );
}
