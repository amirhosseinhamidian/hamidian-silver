import { cookies } from 'next/headers';
import { createHmac, randomBytes } from 'node:crypto';
import { isIP } from 'node:net';
import { normalizeApiOrigin } from '@/lib/api/server-client';
import { SESSION_COOKIE_NAME } from '@/lib/auth/session-cookie';

const deviceCookie = '__Host-hamidian-referral-device';
const riskHeader = 'x-referral-risk-context';

export async function getReferralCheckoutAvailability(): Promise<boolean> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const origin = process.env.HAMIDIAN_API_ORIGIN;
  if (!token || !origin) return false;
  try {
    const response = await fetch(`${normalizeApiOrigin(origin)}/api/v1/referrals/checkout`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(2_500),
    });
    if (!response.ok) return false;
    return ((await response.json()) as { available?: boolean }).available === true;
  } catch {
    return false;
  }
}

function sealRiskContext(request: Request, secret: string, device: string, token: string) {
  const hash = (value: string) => createHmac('sha256', secret).update(value).digest('hex');
  const deviceHash = hash(`referral-device:${device}`);
  const suppliedIp =
    process.env.REFERRAL_RISK_TRUST_PROXY_IP === 'true'
      ? (request.headers.get('x-real-ip')?.trim().toLowerCase() ?? '')
      : '';
  const ip = suppliedIp.replace(/^::ffff:(?=\d+\.)/, '');
  const networkHash = isIP(ip) ? hash(`referral-network:${ip}`) : '-';
  const payload = `${Date.now()}.${deviceHash}.${networkHash}`;
  return `${payload}.${hash(`referral-context:${payload}.${token}`)}`;
}

export async function forwardReferral(request: Request, action: 'overview' | 'code' | 'claim') {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE_NAME)?.value;
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
  const secret = process.env.REFERRAL_RISK_CONTEXT_SECRET;
  const previousDevice = jar.get(deviceCookie)?.value ?? '';
  const validDevice = /^[a-f0-9]{32}$/.test(previousDevice);
  const device =
    action !== 'overview' && secret && secret.length >= 32
      ? validDevice
        ? previousDevice
        : randomBytes(16).toString('hex')
      : null;
  try {
    const upstream = await fetch(`${normalizeApiOrigin(origin)}/api/v1/referrals${path}`, {
      method: action === 'overview' ? 'GET' : 'POST',
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        ...(action === 'claim' ? { 'Content-Type': 'application/json' } : {}),
        ...(device && secret
          ? { [riskHeader]: sealRiskContext(request, secret, device, token) }
          : {}),
      },
      body: action === 'claim' ? await request.text() : undefined,
      signal: request.signal,
    });
    if (upstream.ok && device && !validDevice) {
      jar.set(deviceCookie, device, {
        secure: true,
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 90 * 24 * 60 * 60,
      });
    }
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
