import { describe, expect, it } from 'vitest';

import type { AdminCurrentUser } from '@/lib/auth/access-control';
import { getAdminNavigation, getAdminSection } from '@/lib/navigation/admin-navigation';

const user = {
  id: '10000000-0000-4000-8000-000000000001',
  phone: '+989121234567',
  roles: ['MANAGER'],
  permissions: ['users.read'],
} as AdminCurrentUser;

describe('roles navigation', () => {
  it('exposes stage 35 to users with users.read', () => {
    expect(getAdminNavigation(user).flatMap((group) => group.items)).toEqual(
      expect.arrayContaining([expect.objectContaining({ href: '/roles', roadmapStage: 35 })]),
    );
    expect(getAdminSection('roles')).toEqual(expect.objectContaining({ id: 'roles' }));
  });
});
