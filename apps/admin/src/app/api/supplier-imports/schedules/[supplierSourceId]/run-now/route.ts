import { forwardSupplierImportMutation } from '@/lib/supplier-imports/supplier-imports-bff';

type RouteContext = Readonly<{ params: Promise<{ supplierSourceId: string }> }>;

export async function POST(request: Request, context: RouteContext) {
  const { supplierSourceId } = await context.params;
  return forwardSupplierImportMutation(
    request,
    `/api/v1/supplier-imports/schedules/${encodeURIComponent(supplierSourceId)}/run-now`,
    'POST',
  );
}
