import 'server-only';

import { cookies } from 'next/headers';

import { requestAdminCatalog, readJsonResponse } from '@/lib/catalog/catalog-api';
import { SESSION_COOKIE_NAME } from '@/lib/auth/session-cookie';
import { validateMediaUploadRequest } from '@/lib/security/media-upload';

function responseFromUpstream(response: Response, payload: unknown): Response {
  if (response.status === 204) return new Response(null, { status: 204 });
  return Response.json(payload ?? null, { status: response.status });
}

export async function forwardCatalogMutation(
  request: Request,
  apiPath: string,
  method: 'POST' | 'PATCH' | 'DELETE',
): Promise<Response> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) return Response.json({ message: 'Authentication required.' }, { status: 401 });

  try {
    const body = method === 'DELETE' ? undefined : await request.text();
    const response = await requestAdminCatalog(apiPath, token, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body,
    });
    return responseFromUpstream(response, await readJsonResponse(response));
  } catch {
    return Response.json({ message: 'Catalog service is unavailable.' }, { status: 502 });
  }
}

export async function forwardCatalogUpload(request: Request, apiPath: string): Promise<Response> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) return Response.json({ message: 'Authentication required.' }, { status: 401 });

  try {
    const upload = await validateMediaUploadRequest(request);
    if (!upload.ok) return upload.response;
    const response = await requestAdminCatalog(apiPath, token, {
      method: 'POST',
      body: upload.formData,
    });
    return responseFromUpstream(response, await readJsonResponse(response));
  } catch {
    return Response.json({ message: 'Catalog upload service is unavailable.' }, { status: 502 });
  }
}
