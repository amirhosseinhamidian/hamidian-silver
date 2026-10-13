import { forwardGuideRequest } from '@/lib/guide/guide-bff';

export async function POST(request: Request) {
  return forwardGuideRequest(request, '/api/v1/guide/articles', 'POST');
}
