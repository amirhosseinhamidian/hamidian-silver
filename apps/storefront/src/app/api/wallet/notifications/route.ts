import { forwardWalletRequest } from '@/lib/checkout/bff';

export function GET(request: Request) {
  return forwardWalletRequest(request, 'notifications');
}

export function PATCH(request: Request) {
  return forwardWalletRequest(request, 'notifications');
}
