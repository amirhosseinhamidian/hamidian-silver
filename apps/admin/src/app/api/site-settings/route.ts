import { forwardSiteSettingsJson } from '@/lib/site-settings/site-settings-bff';

export async function PATCH(request: Request) {
  return forwardSiteSettingsJson(request, '/api/v1/site-settings', 'PATCH');
}
