import { deleteAddress, updateAddress } from '@/lib/profile/address-bff';

type RouteContext = Readonly<{ params: Promise<{ addressId: string }> }>;

export async function PATCH(request: Request, { params }: RouteContext): Promise<Response> {
  return updateAddress(request, (await params).addressId);
}

export async function DELETE(_request: Request, { params }: RouteContext): Promise<Response> {
  return deleteAddress((await params).addressId);
}
