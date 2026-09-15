import { forwardCardToCardAccountRequest } from '@/lib/payment-gateways/card-to-card-account-bff';

type RouteContext = Readonly<{ params: Promise<{ accountId: string }> }>;

export async function PATCH(request: Request, { params }: RouteContext) {
  return forwardCardToCardAccountRequest(request, (await params).accountId);
}

export async function DELETE(request: Request, { params }: RouteContext) {
  return forwardCardToCardAccountRequest(request, (await params).accountId);
}
