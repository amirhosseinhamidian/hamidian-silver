import { forwardPlatingMutation } from '@/lib/plating/plating-bff';

type OptionRouteContext = Readonly<{ params: Promise<{ variantId: string; type: string }> }>;

export async function PUT(request: Request, { params }: OptionRouteContext) {
  const { variantId, type } = await params;
  return forwardPlatingMutation(
    request,
    `/api/v1/plating/variants/${encodeURIComponent(variantId)}/options/${encodeURIComponent(type)}`,
    'PUT',
  );
}
