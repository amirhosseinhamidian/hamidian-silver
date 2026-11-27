import {
  forwardSiteSettingsJson,
  readSiteSettingsJson,
} from '@/lib/site-settings/site-settings-bff';

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  return readSiteSettingsJson(`/api/v1/campaigns?${query}`);
}

export async function POST(request: Request) {
  return forwardSiteSettingsJson(request, '/api/v1/campaigns', 'POST');
}
