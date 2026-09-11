import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import {
  ADMIN_RETURN_TO_HEADER,
  buildAdminLoginPath,
  normalizeAdminReturnPath,
} from '@/lib/auth/login-redirect';
import { SESSION_COOKIE_NAME } from '@/lib/auth/session-cookie';

const PUBLIC_ADMIN_ROUTES = new Set(['/login', '/access-denied']);
const SAFE_HTTP_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function isTrustedMutationRequest(request: NextRequest): boolean {
  if (SAFE_HTTP_METHODS.has(request.method.toUpperCase())) return true;

  const origin = request.headers.get('origin');
  if (origin) {
    try {
      return new URL(origin).origin === request.nextUrl.origin;
    } catch {
      return false;
    }
  }

  return request.headers.get('sec-fetch-site') === 'same-origin';
}

export function isPublicAdminRoute(pathname: string): boolean {
  return PUBLIC_ADMIN_ROUTES.has(pathname) || pathname.startsWith('/api/');
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname.startsWith('/api/') && !isTrustedMutationRequest(request)) {
    return NextResponse.json(
      { message: 'Cross-origin administrative mutations are not allowed.' },
      { status: 403 },
    );
  }

  if (isPublicAdminRoute(pathname)) {
    return NextResponse.next();
  }

  const returnTo = normalizeAdminReturnPath(`${pathname}${search}`);

  if (request.cookies.has(SESSION_COOKIE_NAME)) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set(ADMIN_RETURN_TO_HEADER, returnTo);

    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  const loginUrl = new URL(buildAdminLoginPath(returnTo), request.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/((?!_next|favicon.ico|.*\\..*).*)'],
};
