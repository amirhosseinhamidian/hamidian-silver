import { describe, expect, it } from 'vitest';
import type { AdminCurrentUser } from '@/lib/auth/access-control';
import { getAdminNavigation, getAdminSection } from '@/lib/navigation/admin-navigation';

const user = {
  id: 'admin-1',
  phone: '09121234567',
  roles: ['ADMIN'],
  permissions: ['orders.read'],
} as AdminCurrentUser;

describe('notification outbox navigation', () => {
  it('exposes stage 36 to order readers', () => {
    expect(getAdminNavigation(user).flatMap((group) => group.items)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ href: '/notification-outbox', roadmapStage: 36 }),
      ]),
    );
    expect(getAdminSection('notification-outbox')?.permissions).toEqual(['orders.read']);
  });
});
