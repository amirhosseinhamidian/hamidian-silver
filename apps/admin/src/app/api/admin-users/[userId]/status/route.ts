import { forwardUserManagementMutation } from '@/lib/user-management/user-management-bff';

type RouteContext = Readonly<{ params: Promise<{ userId: string }> }>;

export async function PATCH(request: Request, { params }: RouteContext) {
  const { userId } = await params;
  return forwardUserManagementMutation(
    request,
    `/api/v1/admin-users/${encodeURIComponent(userId)}/status`,
    'PATCH',
  );
}
