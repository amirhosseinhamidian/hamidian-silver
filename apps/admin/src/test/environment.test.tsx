import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AdminShell } from '@/components/layout/admin-shell';

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

describe('admin test environment', () => {
  it('renders application-owned components in jsdom', () => {
    render(
      <AdminShell
        account={{
          phone: '09121234567',
          roleLabel: 'ادمین عملیات',
          initials: 'اد',
        }}
        navigation={[]}
        profile={{ firstName: 'ادمین', lastName: 'حمیدیان' }}
      >
        <main>Admin test environment</main>
      </AdminShell>,
    );

    expect(screen.getByRole('main')).toHaveTextContent('Admin test environment');
  });
});
