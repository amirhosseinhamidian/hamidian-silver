import { forwardSupplierImportMutation } from '@/lib/supplier-imports/supplier-imports-bff';

type RouteContext = Readonly<{ params: Promise<{ categoryId: string }> }>;

export async function PATCH(request: Request, context: RouteContext) {
  const { categoryId } = await context.params;
  return forwardSupplierImportMutation(
    request,
    `/api/v1/supplier-imports/categories/${encodeURIComponent(categoryId)}/mapping`,
    'PATCH',
  );
}
