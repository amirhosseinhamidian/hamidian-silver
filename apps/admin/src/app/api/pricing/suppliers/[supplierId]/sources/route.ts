import { forwardSupplierMutation } from '@/lib/suppliers/suppliers-bff';

type SupplierSourcesRouteContext = Readonly<{ params: Promise<{ supplierId: string }> }>;

export async function POST(request: Request, { params }: SupplierSourcesRouteContext) {
  const { supplierId } = await params;
  return forwardSupplierMutation(
    request,
    `/api/v1/pricing/suppliers/${encodeURIComponent(supplierId)}/sources`,
    'POST',
  );
}
