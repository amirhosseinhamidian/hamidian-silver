import { forwardSupplierImageDownload } from '@/lib/supplier-imports/supplier-imports-bff';

type RouteContext = Readonly<{
  params: Promise<{ draftId: string; imageIndex: string }>;
}>;

export async function GET(_request: Request, context: RouteContext) {
  const { draftId, imageIndex } = await context.params;
  return forwardSupplierImageDownload(
    `/api/v1/supplier-imports/drafts/${encodeURIComponent(draftId)}/images/${encodeURIComponent(imageIndex)}/download`,
  );
}
