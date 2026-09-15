import { forwardPricingMutation } from '@/lib/pricing/pricing-bff';

type ProductPriceRouteContext = Readonly<{
  params: Promise<{ productId: string }>;
}>;

export async function PATCH(request: Request, { params }: ProductPriceRouteContext) {
  const { productId } = await params;
  return forwardPricingMutation(
    request,
    `/api/v1/pricing/products/${encodeURIComponent(productId)}/sale-price`,
  );
}
