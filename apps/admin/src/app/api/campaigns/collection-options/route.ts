import { readSiteSettingsJson } from '@/lib/site-settings/site-settings-bff';

export function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  return readSiteSettingsJson(`/api/v1/campaigns/collection-options?${query.toString()}`);
}
