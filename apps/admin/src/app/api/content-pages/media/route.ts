import { forwardContentMediaUpload } from '@/lib/content-pages/content-pages-bff';

export async function POST(request: Request) {
  return forwardContentMediaUpload(request);
}
