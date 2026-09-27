import 'server-only';

import { cookies } from 'next/headers';
import { SESSION_COOKIE_NAME } from '@/lib/auth/session-cookie';
import { requestAdminCatalog, readJsonResponse } from '@/lib/catalog/catalog-api';

export async function forwardSupplierImportMutation(
  request: Request,
  apiPath: string,
  method: 'POST' | 'PATCH',
): Promise<Response> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) return Response.json({ message: 'Authentication required.' }, { status: 401 });
  try {
    const response = await requestAdminCatalog(apiPath, token, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: await request.text(),
    });
    return Response.json((await readJsonResponse(response)) ?? null, { status: response.status });
  } catch {
    return Response.json({ message: 'Supplier import service is unavailable.' }, { status: 502 });
  }
}

export async function forwardSupplierImageDownload(apiPath: string): Promise<Response> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) return Response.json({ message: 'Authentication required.' }, { status: 401 });
  try {
    const response = await requestAdminCatalog(apiPath, token);
    if (!response.ok) {
      return Response.json((await readJsonResponse(response)) ?? null, { status: response.status });
    }
    return new Response(response.body, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('content-type') ?? 'application/octet-stream',
        'Content-Disposition': response.headers.get('content-disposition') ?? 'attachment',
        'Cache-Control': 'private, no-store',
      },
    });
  } catch {
    return Response.json({ message: 'Supplier image download is unavailable.' }, { status: 502 });
  }
}
