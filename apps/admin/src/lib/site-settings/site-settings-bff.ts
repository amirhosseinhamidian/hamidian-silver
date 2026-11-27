import 'server-only';

import { cookies } from 'next/headers';

import { SESSION_COOKIE_NAME } from '@/lib/auth/session-cookie';
import { requestAdminCatalog, readJsonResponse } from '@/lib/catalog/catalog-api';
import { validateMediaUploadRequest } from '@/lib/security/media-upload';

async function token(): Promise<string | null> {
  return (await cookies()).get(SESSION_COOKIE_NAME)?.value ?? null;
}

async function upstreamResponse(response: Response): Promise<Response> {
  return Response.json((await readJsonResponse(response)) ?? null, { status: response.status });
}

export async function forwardSiteSettingsJson(
  request: Request,
  path: string,
  method: 'POST' | 'PATCH' | 'PUT',
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

export async function readSiteSettingsJson(path: string): Promise<Response> {
  const accessToken = await token();
  if (!accessToken) return Response.json({ message: 'Authentication required.' }, { status: 401 });
  try {
    return upstreamResponse(await requestAdminCatalog(path, accessToken));
  } catch {
    return Response.json({ message: 'Site settings service is unavailable.' }, { status: 502 });
  }
}

export async function forwardSiteMediaUpload(
  request: Request,
  campaignMedia = false,
): Promise<Response> {
  const accessToken = await token();
  if (!accessToken) return Response.json({ message: 'Authentication required.' }, { status: 401 });
  try {
    const upload = await validateMediaUploadRequest(request, campaignMedia);
    if (!upload.ok) return upload.response;
    const response = await requestAdminCatalog(
      campaignMedia ? '/api/v1/site-settings/campaign-media' : '/api/v1/site-settings/media',
      accessToken,
      {
        method: 'POST',
        body: upload.formData,
      },
    );
    return upstreamResponse(response);
  } catch {
    return Response.json({ message: 'Site media upload is unavailable.' }, { status: 502 });
  }
}
