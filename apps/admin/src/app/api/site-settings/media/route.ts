import { forwardSiteMediaUpload } from '@/lib/site-settings/site-settings-bff';

export async function POST(request: Request) {
  return forwardSiteMediaUpload(request);
}
