import { forwardSupplierImportMutation } from '@/lib/supplier-imports/supplier-imports-bff';
import { forwardSupplierImportRead } from '@/lib/supplier-imports/supplier-imports-bff';

type RouteContext = Readonly<{ params: Promise<{ draftId: string }> }>;

export async function GET(_request: Request, context: RouteContext) {
  const { draftId } = await context.params;
  return forwardSupplierImportRead(
    `/api/v1/supplier-imports/drafts/${encodeURIComponent(draftId)}`,
  );
}

export async function PATCH(request: Request, context: RouteContext) {
  const { draftId } = await context.params;
  return forwardSupplierImportMutation(
    request,
    `/api/v1/supplier-imports/drafts/${encodeURIComponent(draftId)}`,
    'PATCH',
  );
}
