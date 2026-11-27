import {
  forwardSiteSettingsJson,
  readSiteSettingsJson,
} from '@/lib/site-settings/site-settings-bff';

const endpoint = '/api/v1/festival-themes';

export async function GET(request: Request) {
  const response = await readSiteSettingsJson(`${endpoint}?${new URL(request.url).searchParams}`);
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

export function POST(request: Request) {
  return forwardSiteSettingsJson(request, endpoint, 'POST');
}
