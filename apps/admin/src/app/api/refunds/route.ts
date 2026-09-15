import { forwardRefundMutation } from '@/lib/refunds/refunds-bff';

export async function POST(request: Request) {
  return forwardRefundMutation(request, '/api/v1/finance/refunds');
}
