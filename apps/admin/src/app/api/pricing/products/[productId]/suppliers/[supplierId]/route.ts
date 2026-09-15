import { forwardSupplierMutation } from '@/lib/suppliers/suppliers-bff';

type ProductSupplierRouteContext = Readonly<{
  params: Promise<{ productId: string; supplierId: string }>;
}>;

export async function PUT(request: Request, { params }: ProductSupplierRouteContext) {
  const { productId, supplierId } = await params;
  return forwardSupplierMutation(
    request,
    `/api/v1/pricing/products/${encodeURIComponent(productId)}/suppliers/${encodeURIComponent(supplierId)}`,
    'PUT',
  );
}
