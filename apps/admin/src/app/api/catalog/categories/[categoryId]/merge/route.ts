import { forwardCatalogMutation } from '@/lib/catalog/catalog-bff';

type CategoryMergeContext = Readonly<{ params: Promise<{ categoryId: string }> }>;

export async function POST(request: Request, { params }: CategoryMergeContext) {
  const { categoryId } = await params;
  return forwardCatalogMutation(
    request,
    `/api/v1/catalog/categories/${encodeURIComponent(categoryId)}/merge`,
    'POST',
  );
}
