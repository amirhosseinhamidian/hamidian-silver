import { describe, expect, it } from 'vitest';

import {
  evaluateAdminAccess,
  hasAdministrativeAccess,
  hasAllAdminPermissions,
  hasAnyAdminPermission,
  type AdminCurrentUser,
} from '@/lib/auth/access-control';

function adminUser(overrides: Partial<AdminCurrentUser> = {}): AdminCurrentUser {
  return {
    id: 'user-1',
    phone: '09121234567',
    roles: ['ADMIN'],
    permissions: ['orders.read', 'orders.status.write'],
    ...overrides,
  };
}

describe('admin access control', () => {
  it('allows only administrative roles into the admin application', () => {
    expect(hasAdministrativeAccess(adminUser({ roles: ['ADMIN'] }))).toBe(true);
    expect(hasAdministrativeAccess(adminUser({ roles: ['MANAGER'] }))).toBe(true);
    expect(hasAdministrativeAccess(adminUser({ roles: ['USER'] }))).toBe(false);
  });

  it('evaluates all-of and any-of permission checks independently', () => {
    const user = adminUser();

    expect(hasAllAdminPermissions(user, ['orders.read', 'orders.status.write'])).toBe(true);
    expect(hasAllAdminPermissions(user, ['orders.read', 'finance.read'])).toBe(false);
    expect(hasAnyAdminPermission(user, ['finance.read', 'orders.read'])).toBe(true);
    expect(hasAnyAdminPermission(user, ['finance.read', 'audit.read'])).toBe(false);
  });

  it('distinguishes missing sessions from forbidden roles or permissions', () => {
    expect(evaluateAdminAccess(null)).toBe('unauthenticated');
    expect(evaluateAdminAccess(adminUser({ roles: ['USER'] }))).toBe('forbidden');
    expect(evaluateAdminAccess(adminUser(), ['finance.read'])).toBe('forbidden');
    expect(evaluateAdminAccess(adminUser(), ['orders.read'])).toBe('granted');
  });
});
