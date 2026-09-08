import { forwardRefundMutation } from '@/lib/refunds/refunds-bff';

type Context = Readonly<{ params: Promise<{ refundId: string }> }>;

export async function POST(request: Request, { params }: Context) {
  const { refundId } = await params;
  return forwardRefundMutation(
    request,
    `/api/v1/finance/refunds/${encodeURIComponent(refundId)}/cancel`,
  );
}
