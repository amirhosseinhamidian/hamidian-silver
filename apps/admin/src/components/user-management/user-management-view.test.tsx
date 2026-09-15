import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { UserManagementView } from '@/components/user-management/user-management-view';
import type { UserManagementSnapshot } from '@/lib/user-management/user-management-model';

const snapshot: UserManagementSnapshot = {
  users: [
    {
      id: '10000000-0000-4000-8000-000000000001',
      phone: '09120000000',
      firstName: 'علی',
      lastName: 'حمیدیان',
      isActive: true,
      phoneVerifiedAt: null,
      lastLoginAt: '2026-09-01T10:00:00.000Z',
      createdAt: '2026-08-01T10:00:00.000Z',
      updatedAt: '2026-09-01T10:00:00.000Z',
      activeSessionCount: 1,
      roles: [
        {
          code: 'ADMIN',
          name: 'Admin',
          assignedAt: '2026-08-01T10:00:00.000Z',
          permissions: ['orders.read'],
        },
      ],
      effectivePermissions: ['orders.read'],
    },
  ],
  roles: [
    {
      code: 'ADMIN',
      name: 'Admin',
      description: 'Operational access',
      permissions: [{ code: 'orders.read', name: 'Read orders', description: null }],
    },
  ],
};

describe('user management view', () => {
  it('renders user identity, role, and read-only notice', () => {
    render(
      <UserManagementView
        snapshot={snapshot}
        failed={false}
        currentUserId={snapshot.users[0]!.id}
        canWrite={false}
      />,
    );

    expect(screen.getAllByText('علی حمیدیان').length).toBeGreaterThan(0);
    expect(screen.getAllByText('ادمین عملیات').length).toBeGreaterThan(0);
    expect(screen.getByText(/دسترسی شما فقط برای مشاهده است/)).toBeInTheDocument();
  });

  it('shows a safe error state when the API payload fails', () => {
    render(
      <UserManagementView
        snapshot={{ users: [], roles: [] }}
        failed
        currentUserId="current-user"
        canWrite
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('اطلاعات کاربران دریافت نشد');
  });
});
