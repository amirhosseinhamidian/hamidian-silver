import { forwardWalletRequest } from '@/lib/checkout/bff';

export function GET(request: Request) {
  return forwardWalletRequest(request, 'balance');
}
