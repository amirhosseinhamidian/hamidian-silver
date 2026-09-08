import 'server-only';

import { cookies } from 'next/headers';

import { SESSION_COOKIE_NAME } from '@/lib/auth/session-cookie';
import { requestAdminCatalog, readJsonResponse } from '@/lib/catalog/catalog-api';

async function token(): Promise<string | null> {
  return (await cookies()).get(SESSION_COOKIE_NAME)?.value ?? null;
}

async function upstreamResponse(response: Response): Promise<Response> {
  return Response.json((await readJsonResponse(response)) ?? null, { status: response.status });
}

export async function forwardSiteSettingsJson(
  request: Request,
  path: string,
  method: 'PATCH' | 'PUT',
): Promise<Response> {
  const accessToken = await token();
  if (!accessToken) return Response.json({ message: 'Authentication required.' }, { status: 401 });
  try {
    const response = await requestAdminCatalog(path, accessToken, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: await request.text(),
    });
    return upstreamResponse(response);
  } catch {
    return Response.json({ message: 'Site settings service is unavailable.' }, { status: 502 });
  }
}

export async function forwardSiteMediaUpload(request: Request): Promise<Response> {
  const accessToken = await token();
  if (!accessToken) return Response.json({ message: 'Authentication required.' }, { status: 401 });
  try {
    const response = await requestAdminCatalog('/api/v1/site-settings/media', accessToken, {
      method: 'POST',
      body: await request.formData(),
    });
    return upstreamResponse(response);
  } catch {
    return Response.json({ message: 'Site media upload is unavailable.' }, { status: 502 });
  }
}
