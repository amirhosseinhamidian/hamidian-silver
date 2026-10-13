import { forwardGuideRequest } from '@/lib/guide/guide-bff';

type Context = Readonly<{ params: Promise<{ topicId: string }> }>;

export async function PATCH(request: Request, { params }: Context) {
  const { topicId } = await params;
  return forwardGuideRequest(
    request,
    `/api/v1/guide/topics/${encodeURIComponent(topicId)}`,
    'PATCH',
  );
}

export async function DELETE(request: Request, { params }: Context) {
  const { topicId } = await params;
  return forwardGuideRequest(
    request,
    `/api/v1/guide/topics/${encodeURIComponent(topicId)}`,
    'DELETE',
  );
}
