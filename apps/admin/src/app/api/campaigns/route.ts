import { forwardSiteSettingsJson } from '@/lib/site-settings/site-settings-bff';

export async function POST(request: Request) {
  return forwardSiteSettingsJson(request, '/api/v1/campaigns', 'POST');
}
