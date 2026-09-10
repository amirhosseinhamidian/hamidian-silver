import { forwardSupplierCredit } from '@/lib/supplier-credits/supplier-credits-bff';

type RouteContext = Readonly<{ params: Promise<{ creditId: string }> }>;

export async function GET(_request: Request, { params }: RouteContext) {
  const { creditId } = await params;
  return forwardSupplierCredit(`/api/v1/finance/supplier-credits/${encodeURIComponent(creditId)}`);
}
