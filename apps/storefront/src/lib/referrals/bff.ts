import { cookies } from 'next/headers';
import { normalizeApiOrigin } from '@/lib/api/server-client';
import { SESSION_COOKIE_NAME } from '@/lib/auth/session-cookie';

export async function forwardReferral(request: Request, action: 'overview' | 'code' | 'claim') {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const headers = { 'Cache-Control': 'private, no-store' };
  if (!token) return Response.json(null, { status: 401, headers });
  const origin = process.env.HAMIDIAN_API_ORIGIN;
  if (!origin) return Response.json(null, { status: 503, headers });

  const page = new URL(request.url).searchParams.get('page') ?? '1';
  const path = action === 'overview' ? `?page=${encodeURIComponent(page)}` : `/${action}`;
  if (
    action !== 'overview' &&
    !request.headers.get('content-type')?.startsWith('application/json')
  ) {
    return Response.json(null, { status: 415, headers });
  }
  try {
    const upstream = await fetch(`${normalizeApiOrigin(origin)}/api/v1/referrals${path}`, {
      method: action === 'overview' ? 'GET' : 'POST',
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        ...(action === 'claim' ? { 'Content-Type': 'application/json' } : {}),
      },
      body: action === 'claim' ? await request.text() : undefined,
      signal: request.signal,
    });
    return new Response(await upstream.arrayBuffer(), {
      status: upstream.status,
      headers: {
        ...headers,
        'Content-Type': upstream.headers.get('content-type') ?? 'application/json',
      },
    });
  } catch {
    return Response.json(null, { status: 502, headers });
  }
}
