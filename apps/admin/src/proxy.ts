import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import {
  ADMIN_RETURN_TO_HEADER,
  buildAdminLoginPath,
  normalizeAdminReturnPath,
} from '@/lib/auth/login-redirect';
import { SESSION_COOKIE_NAME } from '@/lib/auth/session-cookie';

const PUBLIC_ADMIN_ROUTES = new Set(['/login', '/access-denied']);

export function isPublicAdminRoute(pathname: string): boolean {
  return PUBLIC_ADMIN_ROUTES.has(pathname) || pathname.startsWith('/api/');
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

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
  matcher: ['/((?!api|_next|favicon.ico|.*\\..*).*)'],
};
