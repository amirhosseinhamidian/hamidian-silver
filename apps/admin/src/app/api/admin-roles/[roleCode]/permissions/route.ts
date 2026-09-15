import { forwardRolePermissionsMutation } from '@/lib/role-management/role-management-bff';
type RouteContext = Readonly<{ params: Promise<{ roleCode: string }> }>;
export async function PUT(request: Request, { params }: RouteContext) {
  const { roleCode } = await params;
  return forwardRolePermissionsMutation(request, roleCode);
}
