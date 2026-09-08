import { describe, expect, it } from 'vitest';

import type { AdminCurrentUser } from '@/lib/auth/access-control';
import { getAdminNavigation, getAdminSection } from '@/lib/navigation/admin-navigation';

const reader: AdminCurrentUser = {
  id: 'admin-settlements-reader',
  phone: '09120000000',
  roles: ['ADMIN'],
  permissions: ['finance.read'],
};

describe('supplier settlements navigation', () => {
  it('exposes settlement batches to finance readers', () => {
    const items = getAdminNavigation(reader).flatMap((group) => group.items);

    expect(
      items.some(
        (item) =>
          item.id === 'supplier-settlements' &&
          item.href === '/supplier-settlements' &&
          item.roadmapStage === 30,
      ),
    ).toBe(true);
    expect(getAdminSection('supplier-settlements')?.permissions).toEqual(['finance.read']);
  });
});
