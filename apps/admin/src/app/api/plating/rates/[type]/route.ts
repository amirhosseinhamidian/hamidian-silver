import { forwardPlatingMutation } from '@/lib/plating/plating-bff';

type RateRouteContext = Readonly<{ params: Promise<{ type: string }> }>;

export async function PUT(request: Request, { params }: RateRouteContext) {
  const { type } = await params;
  return forwardPlatingMutation(
    request,
    `/api/v1/plating/rates/${encodeURIComponent(type)}`,
    'PUT',
  );
}
