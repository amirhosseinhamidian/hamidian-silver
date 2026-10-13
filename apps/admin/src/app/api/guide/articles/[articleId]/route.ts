import { forwardGuideRequest } from '@/lib/guide/guide-bff';

type Context = Readonly<{ params: Promise<{ articleId: string }> }>;

export async function PATCH(request: Request, { params }: Context) {
  const { articleId } = await params;
  return forwardGuideRequest(
    request,
    `/api/v1/guide/articles/${encodeURIComponent(articleId)}`,
    'PATCH',
  );
}

export async function DELETE(request: Request, { params }: Context) {
  const { articleId } = await params;
  const expectedVersion = new URL(request.url).searchParams.get('expectedVersion') ?? '';
  return forwardGuideRequest(
    request,
    `/api/v1/guide/articles/${encodeURIComponent(articleId)}?expectedVersion=${encodeURIComponent(expectedVersion)}`,
    'DELETE',
  );
}
