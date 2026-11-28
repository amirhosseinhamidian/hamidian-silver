import { getAdminCurrentUser } from '@/lib/auth/session';
import {
  forwardSiteSettingsJson,
  readSiteSettingsJson,
} from '@/lib/site-settings/site-settings-bff';

const upstream = '/api/v1/reward-policies/policy-simulator/product-options';
const headers = { 'Cache-Control': 'private, no-store' };
type Context = { params: Promise<{ parts?: string[] }> };

async function guard() {
  const user = await getAdminCurrentUser();
  if (!user) return Response.json(null, { status: 401, headers });
  if (!user.permissions.includes('finance.read'))
    return Response.json(null, { status: 403, headers });
  return null;
}

export async function GET(request: Request, { params }: Context) {
  const denied = await guard();
  if (denied) return denied;
  const { parts } = await params;
  if (parts?.length) {
    if (parts.length !== 2 || parts[1] !== 'variants' || /^\.{1,2}$|[\/\\\0]/.test(parts[0]))
      return Response.json(null, { status: 404, headers });
    const response = await readSiteSettingsJson(
      `${upstream}/${encodeURIComponent(parts[0])}/variants`,
    );
    response.headers.set('Cache-Control', headers['Cache-Control']);
    return response;
  }
  const response = await readSiteSettingsJson(`${upstream}?${new URL(request.url).searchParams}`);
  response.headers.set('Cache-Control', headers['Cache-Control']);
  return response;
}

export async function POST(request: Request, { params }: Context) {
  const denied = await guard();
  if (denied) return denied;
  if ((await params).parts?.length) return Response.json(null, { status: 404, headers });
  const response = await forwardSiteSettingsJson(request, upstream, 'POST');
  response.headers.set('Cache-Control', headers['Cache-Control']);
  return response;
}
