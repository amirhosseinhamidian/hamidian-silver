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
      'incidents',
      'orders',
      'products',
      'product-imports',
      'variants',
      'categories',
      'catalog-attributes',
      'brands',
      'inventory',
      'inventory-alerts',
      'shipping',
      'plating',
      'fulfillment',
      'returns',
      'content',
      'knowledge',
      'notification-outbox',
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
      'payment-gateways',
      'transactions',
      'reconciliations',
      'refunds',
      'payments',
      'supplier-credits',
      'supplier-payables',
      'supplier-settlements',
      'finance',
      'wallet-reconciliation',
      'customer-club',
      'reward-policies',
      'club-referrals',
      'club-wallet',
      'club-policy-history',
      'club-operations',
      'club-referral-risk',
      'club-reports',
      'club-simulator',
      'campaigns',
      'growth',
      'users',
      'roles',
      'shipping-settings',
      'settings',
      'seo',
      'audit',
    ]);
  });

  it('resolves the club page or financial report under the appropriate link', () => {
    const navigation = getAdminNavigation(user({ permissions: ['finance.read'] }));
    expect(findAdminNavigationItem('/reward-policies/wallet-operations', navigation)?.id).toBe(
      'club-wallet',
    );
    expect(findAdminNavigationItem('/reward-policies/maintenance', navigation)?.id).toBe(
      'wallet-reconciliation',
    );
    expect(getAdminSection('customer-club')?.permissions).toEqual(['finance.read']);
  });

  it('keeps the marketing workspace and growth reporting independently permissioned', () => {
    const settingsNavigation = getAdminNavigation(user({ permissions: ['settings.read'] }));
    const financeNavigation = getAdminNavigation(user({ permissions: ['finance.read'] }));

    expect(
      settingsNavigation.find(({ id }) => id === 'marketing')?.items.map(({ href }) => href),
    ).toEqual(['/campaigns']);
    expect(
      financeNavigation.find(({ id }) => id === 'marketing')?.items.map(({ href }) => href),
    ).toEqual(['/growth']);
    expect(findAdminNavigationItem('/campaigns/themes', settingsNavigation)?.id).toBe('campaigns');
    expect(findAdminNavigationItem('/growth/festivals/123', financeNavigation)?.id).toBe('growth');
  });

  it('exposes plating, pricing and supplier settings to pricing readers', () => {
    const items = getAdminNavigation(user({ permissions: ['pricing.read'] })).flatMap(
      (group) => group.items,
    );

    expect(items.map((item) => item.id)).toEqual([
      'dashboard',
      'plating-settings',
      'pricing',
      'suppliers',
    ]);
  });

  it('resolves sections and nested active navigation paths', () => {
    const navigation = getAdminNavigation(user());

    expect(getAdminSection('products')?.permissions).toEqual(['catalog.read']);
    expect(getAdminSection('product-imports')?.permissions).toEqual(['catalog.read']);
    expect(getAdminSection('variants')?.permissions).toEqual(['catalog.read']);
    expect(getAdminSection('catalog-attributes')?.permissions).toEqual(['catalog.read']);
    expect(getAdminSection('payment-gateways')?.permissions).toEqual(['settings.read']);
    expect(getAdminSection('shipping-settings')?.permissions).toEqual(['settings.read']);
    expect(getAdminSection('transactions')?.permissions).toEqual(['finance.read']);
    expect(getAdminSection('reconciliations')?.permissions).toEqual(['finance.read']);
    expect(getAdminSection('refunds')?.permissions).toEqual(['finance.read']);
    expect(getAdminSection('payments')?.permissions).toEqual(['finance.read']);
    expect(getAdminSection('supplier-credits')?.permissions).toEqual(['finance.read']);
    expect(getAdminSection('supplier-settlements')?.permissions).toEqual(['finance.read']);
    expect(getAdminSection('incidents')?.permissions).toEqual(['orders.read']);
    expect(getAdminSection('unknown')).toBeUndefined();
    expect(findAdminNavigationItem('/orders/HS-1042', navigation)?.id).toBe('orders');
    expect(findAdminNavigationItem('/variants/product-1', navigation)?.id).toBe('variants');
    expect(findAdminNavigationItem('/catalog-attributes', navigation)?.id).toBe(
      'catalog-attributes',
    );
    expect(findAdminNavigationItem('/unknown', navigation)).toBeUndefined();
    expect(isAdminNavigationItemActive('/orders/HS-1042', '/orders')).toBe(true);
    expect(isAdminNavigationItemActive('/orders', '/')).toBe(false);
  });
});
