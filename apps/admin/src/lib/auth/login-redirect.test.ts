import { describe, expect, it } from 'vitest';

import { buildAdminLoginPath, normalizeAdminReturnPath } from '@/lib/auth/login-redirect';

describe('normalizeAdminReturnPath', () => {
  it('keeps safe internal admin paths', () => {
    expect(normalizeAdminReturnPath('/orders?page=2#pending')).toBe('/orders?page=2#pending');
  });

  it('rejects external, malformed and recursive login redirects', () => {
    expect(normalizeAdminReturnPath('https://example.com')).toBe('/');
    expect(normalizeAdminReturnPath('//example.com')).toBe('/');
    expect(normalizeAdminReturnPath('/\\example.com')).toBe('/');
    expect(normalizeAdminReturnPath('/login?next=/orders')).toBe('/');
    expect(normalizeAdminReturnPath(undefined)).toBe('/');
  });

  it('builds an encoded login redirect from safe internal paths only', () => {
    expect(buildAdminLoginPath('/orders?status=payment review')).toBe(
      '/login?next=%2Forders%3Fstatus%3Dpayment%2520review',
    );
    expect(buildAdminLoginPath('https://example.com')).toBe('/login?next=%2F');
  });
});
