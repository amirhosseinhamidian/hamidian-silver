import { forwardContentPageUpdate } from '@/lib/content-pages/content-pages-bff';

type RouteContext = Readonly<{ params: Promise<{ key: string }> }>;

export async function PUT(request: Request, { params }: RouteContext) {
  const { key } = await params;
  return forwardContentPageUpdate(request, key);
}
