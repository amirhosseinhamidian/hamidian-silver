import { readSiteSettingsJson } from '@/lib/site-settings/site-settings-bff';

export function GET() {
  return readSiteSettingsJson('/api/v1/campaigns/selection-taxonomy');
}
