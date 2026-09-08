import { describe, expect, it } from 'vitest';

import {
  parseManagedUser,
  parseUserManagementSnapshot,
} from '@/lib/user-management/user-management-model';

const user = {
  id: '10000000-0000-4000-8000-000000000001',
  phone: '09120000000',
  firstName: 'علی',
  lastName: null,
  isActive: true,
  phoneVerifiedAt: null,
  lastLoginAt: null,
  createdAt: '2026-09-01T10:00:00.000Z',
  updatedAt: '2026-09-01T10:00:00.000Z',
  activeSessionCount: 1,
  roles: [
    {
      code: 'ADMIN',
      name: 'Admin',
      assignedAt: '2026-09-01T10:00:00.000Z',
      permissions: ['orders.read'],
    },
  ],
  effectivePermissions: ['orders.read'],
};

const role = {
  code: 'ADMIN',
  name: 'Admin',
  description: null,
  permissions: [{ code: 'orders.read', name: 'Read orders', description: null }],
};

describe('user management model', () => {
  it('parses a valid management snapshot', () => {
    expect(parseUserManagementSnapshot({ users: [user], roles: [role] })).toEqual({
      users: [user],
      roles: [role],
    });
  });

  it('rejects unknown role and permission codes', () => {
    expect(parseManagedUser({ ...user, effectivePermissions: ['root.everything'] })).toBeNull();
    expect(
      parseUserManagementSnapshot({
        users: [user],
        roles: [{ ...role, code: 'SUPERUSER' }],
      }),
    ).toBeNull();
  });
});
