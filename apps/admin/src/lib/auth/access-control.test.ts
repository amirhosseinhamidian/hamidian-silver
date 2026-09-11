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

  it.each([
    { role: 'MANAGER' as const, expected: 'granted' as const },
    { role: 'ADMIN' as const, expected: 'granted' as const },
    { role: 'USER' as const, expected: 'forbidden' as const },
  ])('returns $expected for the $role role at the panel boundary', ({ role, expected }) => {
    expect(evaluateAdminAccess(adminUser({ roles: [role] }))).toBe(expected);
  });

  it('requires every requested permission even when the user has an administrative role', () => {
    const manager = adminUser({
      roles: ['MANAGER'],
      permissions: ['finance.read', 'finance.write'],
    });
    const admin = adminUser({
      roles: ['ADMIN'],
      permissions: ['orders.read', 'orders.status.write'],
    });

    expect(evaluateAdminAccess(manager, ['finance.read', 'finance.write'])).toBe('granted');
    expect(evaluateAdminAccess(admin, ['finance.read'])).toBe('forbidden');
  });
});
