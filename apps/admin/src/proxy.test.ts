import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';

import { ADMIN_RETURN_TO_HEADER } from '@/lib/auth/login-redirect';
import { SESSION_COOKIE_NAME } from '@/lib/auth/session-cookie';
import { config, isPublicAdminRoute, isTrustedMutationRequest, proxy } from '@/proxy';

describe('admin proxy', () => {
  it('redirects anonymous page requests to login and preserves the internal destination', () => {
    const response = proxy(
      new NextRequest('https://admin.example/orders?status=payment%20review&page=2'),
    );
    const location = new URL(response.headers.get('location') ?? '');

    expect(response.status).toBe(307);
    expect(location.origin).toBe('https://admin.example');
    expect(location.pathname).toBe('/login');
    expect(location.searchParams.get('next')).toBe('/orders?status=payment%20review&page=2');
  });

  it('allows protected routes through when the host-only session cookie exists', () => {
    const request = new NextRequest('https://admin.example/orders?status=pending', {
      headers: { cookie: `${SESSION_COOKIE_NAME}=opaque-session` },
    });
    const response = proxy(request);

    expect(response.status).toBe(200);
    expect(response.headers.get('x-middleware-next')).toBe('1');
    expect(response.headers.get(`x-middleware-request-${ADMIN_RETURN_TO_HEADER}`)).toBe(
      '/orders?status=pending',
    );
  });

  it('keeps login, access-denied and auth API routes public', () => {
    expect(isPublicAdminRoute('/login')).toBe(true);
    expect(isPublicAdminRoute('/access-denied')).toBe(true);
    expect(isPublicAdminRoute('/api/auth/otp/request')).toBe(true);

    const response = proxy(new NextRequest('https://admin.example/login?next=%2Forders'));
    expect(response.headers.get('x-middleware-next')).toBe('1');
  });

  it('runs API requests through the proxy while excluding framework assets and public files', () => {
    expect(config.matcher).toEqual(['/((?!_next|favicon.ico|.*\\..*).*)']);
  });

  it('allows same-origin administrative mutations', () => {
    const request = new NextRequest('https://admin.example/api/refunds/refund-1/confirm', {
      method: 'POST',
      headers: { origin: 'https://admin.example' },
    });

    expect(isTrustedMutationRequest(request)).toBe(true);
    expect(proxy(request).headers.get('x-middleware-next')).toBe('1');
  });

  it('rejects cross-origin administrative mutations before a BFF can use the session cookie', async () => {
    const response = proxy(
      new NextRequest('https://admin.example/api/refunds/refund-1/confirm', {
        method: 'POST',
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=opaque-session`,
          origin: 'https://attacker.example',
          'sec-fetch-site': 'cross-site',
        },
      }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      message: 'Cross-origin administrative mutations are not allowed.',
    });
  });

  it('accepts browser same-origin metadata when Origin is omitted', () => {
    const request = new NextRequest('https://admin.example/api/auth/logout', {
      method: 'POST',
      headers: { 'sec-fetch-site': 'same-origin' },
    });

    expect(isTrustedMutationRequest(request)).toBe(true);
  });
});
