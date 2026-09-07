import { forwardPlatingMutation } from '@/lib/plating/plating-bff';

type EligibilityRouteContext = Readonly<{ params: Promise<{ variantId: string }> }>;

export async function PATCH(request: Request, { params }: EligibilityRouteContext) {
  const { variantId } = await params;
  return forwardPlatingMutation(
    request,
    `/api/v1/plating/variants/${encodeURIComponent(variantId)}/eligibility`,
    'PATCH',
  );
}
