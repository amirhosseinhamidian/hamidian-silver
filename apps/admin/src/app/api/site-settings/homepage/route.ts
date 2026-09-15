import { forwardSiteSettingsJson } from '@/lib/site-settings/site-settings-bff';

export async function PUT(request: Request) {
  return forwardSiteSettingsJson(request, '/api/v1/site-settings/homepage', 'PUT');
}
