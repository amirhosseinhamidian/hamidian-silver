import { forwardSiteSettingsJson } from '@/lib/site-settings/site-settings-bff';

export function POST(request: Request) {
  return forwardSiteSettingsJson(request, '/api/v1/festival-themes/archive', 'POST');
}
