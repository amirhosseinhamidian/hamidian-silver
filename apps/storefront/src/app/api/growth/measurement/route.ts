import { normalizeApiOrigin } from '@/lib/api/server-client';

const maximumPayloadBytes = 24 * 1024;

export async function POST(request: Request): Promise<Response> {
  const site = request.headers.get('sec-fetch-site');
  if (site && site !== 'same-origin') return new Response(null, { status: 403 });
  if (!request.headers.get('content-type')?.startsWith('application/json')) {
    return new Response(null, { status: 415 });
  }
  if (Number(request.headers.get('content-length')) > maximumPayloadBytes) {
    return new Response(null, { status: 413 });
  }
  try {
    const body = await request.text();
    if (Buffer.byteLength(body) > maximumPayloadBytes) return new Response(null, { status: 413 });
    const origin = process.env.HAMIDIAN_API_ORIGIN;
    if (!origin) return new Response(null, { status: 503 });
    const response = await fetch(
      `${normalizeApiOrigin(origin)}/api/v1/growth-attribution/measurement`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        cache: 'no-store',
        signal: AbortSignal.timeout(3000),
      },
    );
    return new Response(null, { status: response.status });
  } catch {
    return new Response(null, { status: 503 });
  }
}
