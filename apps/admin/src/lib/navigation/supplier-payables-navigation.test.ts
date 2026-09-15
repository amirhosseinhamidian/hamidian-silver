import { describe, expect, it } from 'vitest';

import type { AdminCurrentUser } from '@/lib/auth/access-control';
import { getAdminNavigation, getAdminSection } from '@/lib/navigation/admin-navigation';

const financeReader: AdminCurrentUser = {
  id: 'admin-payables-reader',
  phone: '09120000000',
  roles: ['ADMIN'],
  permissions: ['finance.read'],
};

describe('supplier payables navigation', () => {
  it('exposes payable management only through finance read access', () => {
    const items = getAdminNavigation(financeReader).flatMap((group) => group.items);

    expect(
      items.some((item) => item.id === 'supplier-payables' && item.href === '/supplier-payables'),
    ).toBe(true);
    expect(getAdminSection('supplier-payables')?.permissions).toEqual(['finance.read']);
  });
});
