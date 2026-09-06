import { setDefaultAddress } from '@/lib/profile/address-bff';

type RouteContext = Readonly<{ params: Promise<{ addressId: string }> }>;

export async function PATCH(_request: Request, { params }: RouteContext): Promise<Response> {
  return setDefaultAddress((await params).addressId);
}
