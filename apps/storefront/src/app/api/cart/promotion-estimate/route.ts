import type { components } from '@hamidian/contracts';

import { createServerApiClient } from '@/lib/api/server-client';

export async function POST(request: Request) {
  const apiOrigin = process.env.HAMIDIAN_API_ORIGIN;
  if (!apiOrigin) return Response.json(null, { status: 503 });
  try {
    const body = (await request.json()) as components['schemas']['PromotionEstimateRequestDto'];
    const { data, error, response } = await createServerApiClient({ apiOrigin }).POST(
      '/api/v1/orders/promotion-estimate',
      {
        body,
        cache: 'no-store',
        signal: request.signal,
      },
    );
    return Response.json(data ?? error ?? null, {
      status: response.status,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch {
    return Response.json(null, { status: 502 });
  }
}
