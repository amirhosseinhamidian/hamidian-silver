import { readSiteSettingsJson } from '@/lib/site-settings/site-settings-bff';

export async function GET(request: Request) {
  const response = await readSiteSettingsJson(
    `/api/v1/festival-themes/history?${new URL(request.url).searchParams}`,
  );
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}
