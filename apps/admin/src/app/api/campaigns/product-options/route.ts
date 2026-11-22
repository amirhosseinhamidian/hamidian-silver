import { readSiteSettingsJson } from '@/lib/site-settings/site-settings-bff';

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get('q')?.trim() ?? '';
  if (q.length < 2 || q.length > 96)
    return Response.json({ message: 'Invalid product search.' }, { status: 400 });
  return readSiteSettingsJson(`/api/v1/campaigns/product-options?${new URLSearchParams({ q })}`);
}
