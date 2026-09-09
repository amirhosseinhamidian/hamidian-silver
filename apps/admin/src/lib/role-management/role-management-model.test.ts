import { describe, expect, it } from 'vitest';

import { parseRoleManagementSnapshot } from './role-management-model';

const validSnapshot = {
  roles: [
    {
      code: 'ADMIN',
      name: 'Admin',
      description: 'Operational access',
      isEditable: true,
      assignedUserCount: 2,
      permissionCodes: ['catalog.read'],
    },
  ],
  permissions: [
    {
      code: 'catalog.read',
      name: 'Read catalog',
      description: 'View catalog data.',
    },
  ],
};

describe('role management model', () => {
  it('parses a valid role management snapshot', () => {
    expect(parseRoleManagementSnapshot(validSnapshot)).toEqual(validSnapshot);
  });

  it('rejects unknown permission codes', () => {
    expect(
      parseRoleManagementSnapshot({
        ...validSnapshot,
        roles: [{ ...validSnapshot.roles[0], permissionCodes: ['root.everything'] }],
      }),
    ).toBeNull();
  });

  it('rejects invalid assigned user counts', () => {
    expect(
      parseRoleManagementSnapshot({
        ...validSnapshot,
        roles: [{ ...validSnapshot.roles[0], assignedUserCount: -1 }],
      }),
    ).toBeNull();
  });
});
