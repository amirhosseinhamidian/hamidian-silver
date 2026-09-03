import { describe, expect, it } from 'vitest';

import {
  createClearedSessionCookieOptions,
  createSessionCookieOptions,
  hasAdministrativeAccess,
  SESSION_COOKIE_NAME,
  toBrowserLoginResponse,
} from './session-cookie';

describe('admin session cookie', () => {
  it('uses an independent host-only secure HttpOnly cookie', () => {
    const options = createSessionCookieOptions('2030-01-02T03:04:05.000Z');

    expect(SESSION_COOKIE_NAME).toBe('__Host-hamidian-admin-session');
    expect(options.httpOnly).toBe(true);
    expect(options.secure).toBe(true);
    expect(options.sameSite).toBe('lax');
    expect(options.path).toBe('/');
    expect('domain' in options).toBe(false);
    expect(options.expires.toISOString()).toBe('2030-01-02T03:04:05.000Z');
  });

  it('clears the same host-only cookie attributes', () => {
    const options = createClearedSessionCookieOptions();

    expect(options.maxAge).toBe(0);
    expect(options.expires.getTime()).toBe(0);
    expect(options.secure).toBe(true);
    expect(options.path).toBe('/');
    expect('domain' in options).toBe(false);
  });

  it('never exposes the backend bearer token in the browser login response', () => {
    const response = toBrowserLoginResponse({
      accessToken: 'opaque-session-token',
      tokenType: 'Bearer',
      expiresAt: '2030-01-02T03:04:05.000Z',
      user: {
        id: 'user-1',
        phone: '09121234567',
      },
    });

    expect('accessToken' in response).toBe(false);
    expect('tokenType' in response).toBe(false);
  });

  it('accepts only administrative backend roles', () => {
    const baseUser = {
      id: 'user-1',
      phone: '09121234567',
      permissions: [],
    };

    expect(hasAdministrativeAccess({ ...baseUser, roles: ['ADMIN'] })).toBe(true);
    expect(hasAdministrativeAccess({ ...baseUser, roles: ['MANAGER'] })).toBe(true);
    expect(hasAdministrativeAccess({ ...baseUser, roles: ['USER'] })).toBe(false);
  });
});
