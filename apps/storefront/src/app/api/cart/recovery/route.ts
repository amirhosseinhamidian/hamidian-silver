import { cookies } from 'next/headers';
import { normalizeApiOrigin } from '@/lib/api/server-client';
import { SESSION_COOKIE_NAME } from '@/lib/auth/session-cookie';

const headers = { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' };

async function forward(request: Request, action = '') {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) return Response.json(null, { status: 401, headers });
  const origin = process.env.HAMIDIAN_API_ORIGIN;
  if (!origin) return Response.json(null, { status: 503, headers });
  if (
    request.method !== 'GET' &&
    !request.headers.get('content-type')?.startsWith('application/json')
  )
    return Response.json(null, { status: 415, headers });
  try {
    const response = await fetch(`${normalizeApiOrigin(origin)}/api/v1/cart-recovery${action}`, {
      method: request.method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: request.method === 'GET' ? undefined : await request.text(),
      cache: 'no-store',
      signal: request.signal,
    });
    return Response.json(await response.json(), { status: response.status, headers });
  } catch {
    return Response.json(null, { status: 502, headers });
  }
}

export function GET(request: Request) {
  return forward(request);
}

export function PUT(request: Request) {
  return forward(request);
}

export function POST(request: Request) {
  const action = new URL(request.url).searchParams.get('action');
  if (!action || !['preview', 'restore', 'hide', 'discard'].includes(action))
    return Response.json(null, { status: 400, headers });
  return forward(request, `/${action}`);
}
