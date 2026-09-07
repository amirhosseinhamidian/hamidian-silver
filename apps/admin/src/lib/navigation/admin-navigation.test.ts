import { describe, expect, it } from 'vitest';

import type { AdminCurrentUser } from '@/lib/auth/access-control';
import {
  findAdminNavigationItem,
  getAdminNavigation,
  getAdminSection,
  isAdminNavigationItemActive,
} from '@/lib/navigation/admin-navigation';

function user(overrides: Partial<AdminCurrentUser> = {}): AdminCurrentUser {
  return {
    id: 'admin-1',
    phone: '09121234567',
    roles: ['ADMIN'],
    permissions: ['orders.read', 'catalog.read', 'inventory.read', 'cms.read'],
    ...overrides,
  };
}

describe('admin navigation', () => {
  it('only includes modules permitted for the current account', () => {
    const items = getAdminNavigation(user()).flatMap((group) => group.items);

    expect(items.map((item) => item.id)).toEqual([
      'dashboard',
      'alerts',
      'orders',
      'products',
      'categories',
      'brands',
      'inventory',
      'inventory-alerts',
      'plating',
      'fulfillment',
      'content',
    ]);
    expect(items.some((item) => item.id === 'finance')).toBe(false);
    expect(items.some((item) => item.id === 'users')).toBe(false);
  });

  it('exposes privileged modules when their permissions are granted', () => {
    const items = getAdminNavigation(
      user({ permissions: ['finance.read', 'users.read', 'settings.read', 'audit.read'] }),
    ).flatMap((group) => group.items);

    expect(items.map((item) => item.id)).toEqual([
      'dashboard',
      'finance',
      'suppliers',
      'users',
      'settings',
      'audit',
    ]);
  });

  it('exposes plating settings to pricing readers', () => {
    const items = getAdminNavigation(user({ permissions: ['pricing.read'] })).flatMap(
      (group) => group.items,
    );

    expect(items.map((item) => item.id)).toEqual(['dashboard', 'plating-settings']);
  });

  it('resolves sections and nested active navigation paths', () => {
    const navigation = getAdminNavigation(user());

    expect(getAdminSection('products')?.permissions).toEqual(['catalog.read']);
    expect(getAdminSection('unknown')).toBeUndefined();
    expect(findAdminNavigationItem('/orders/HS-1042', navigation)?.id).toBe('orders');
    expect(findAdminNavigationItem('/unknown', navigation)).toBeUndefined();
    expect(isAdminNavigationItemActive('/orders/HS-1042', '/orders')).toBe(true);
    expect(isAdminNavigationItemActive('/orders', '/')).toBe(false);
  });
});
