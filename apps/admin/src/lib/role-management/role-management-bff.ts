import 'server-only';
import { cookies } from 'next/headers';
import { SESSION_COOKIE_NAME } from '@/lib/auth/session-cookie';
import { requestAdminCatalog, readJsonResponse } from '@/lib/catalog/catalog-api';

export async function forwardRolePermissionsMutation(
  request: Request,
  roleCode: string,
): Promise<Response> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) return Response.json({ message: 'Authentication required.' }, { status: 401 });
  if (roleCode !== 'ADMIN')
    return Response.json({ message: 'Only the admin role is editable.' }, { status: 400 });
  try {
    const response = await requestAdminCatalog(
      `/api/v1/admin-roles/${encodeURIComponent(roleCode)}/permissions`,
      token,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: await request.text(),
      },
    );
    return Response.json((await readJsonResponse(response)) ?? null, { status: response.status });
  } catch {
    return Response.json({ message: 'Role management service is unavailable.' }, { status: 502 });
  }
}
