import { forwardSupplierImportMutation } from '@/lib/supplier-imports/supplier-imports-bff';

type RouteContext = Readonly<{ params: Promise<{ changeId: string }> }>;

export async function POST(request: Request, context: RouteContext) {
  const { changeId } = await context.params;
  return forwardSupplierImportMutation(
    request,
    `/api/v1/supplier-imports/changes/${encodeURIComponent(changeId)}/acknowledge`,
    'POST',
  );
}
