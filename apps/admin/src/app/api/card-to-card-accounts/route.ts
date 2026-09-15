import { forwardCardToCardAccountRequest } from '@/lib/payment-gateways/card-to-card-account-bff';

export async function POST(request: Request) {
  return forwardCardToCardAccountRequest(request);
}
