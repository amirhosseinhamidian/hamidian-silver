import { forwardWalletRequest } from '@/lib/checkout/bff';

export function POST(request: Request) {
  return forwardWalletRequest(request, 'estimate');
}
