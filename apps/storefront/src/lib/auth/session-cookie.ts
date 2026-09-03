import type { components } from '@hamidian/contracts';

type LoginResponse = components['schemas']['LoginResponseDto'];

export type BrowserLoginResponse = Pick<LoginResponse, 'expiresAt' | 'user'>;

export const SESSION_COOKIE_NAME = '__Host-hamidian-session';

const SESSION_COOKIE_BASE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: 'lax' as const,
  path: '/',
};

export function createSessionCookieOptions(expiresAt: string) {
  const expires = new Date(expiresAt);

  if (Number.isNaN(expires.getTime())) {
    throw new TypeError('Session expiration must be a valid date-time.');
  }

  return {
    ...SESSION_COOKIE_BASE_OPTIONS,
    expires,
  };
}

export function createClearedSessionCookieOptions() {
  return {
    ...SESSION_COOKIE_BASE_OPTIONS,
    expires: new Date(0),
    maxAge: 0,
  };
}

export function toBrowserLoginResponse(login: LoginResponse): BrowserLoginResponse {
  return {
    expiresAt: login.expiresAt,
    user: login.user,
  };
}
