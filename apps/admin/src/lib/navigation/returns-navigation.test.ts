import { describe, expect, it } from 'vitest';

import type { AdminCurrentUser } from '@/lib/auth/access-control';
import { getAdminNavigation, getAdminSection } from '@/lib/navigation/admin-navigation';

const reader: AdminCurrentUser = {
  id: 'admin-returns-reader',
  phone: '09120000000',
  roles: ['ADMIN'],
  permissions: ['orders.read'],
};

describe('returns navigation', () => {
  it('exposes return management to order readers', () => {
    const items = getAdminNavigation(reader).flatMap((group) => group.items);

    expect(items.some((item) => item.id === 'returns' && item.href === '/returns')).toBe(true);
    expect(getAdminSection('returns')?.permissions).toEqual(['orders.read']);
  });
});
