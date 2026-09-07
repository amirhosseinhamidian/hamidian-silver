import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AdminShell } from '@/components/layout/admin-shell';
import type { AdminCurrentUser } from '@/lib/auth/access-control';
import { getAdminNavigation } from '@/lib/navigation/admin-navigation';

const navigationMocks = vi.hoisted(() => ({
  pathname: '/products',
  replace: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => navigationMocks.pathname,
  useRouter: () => ({
    replace: navigationMocks.replace,
    refresh: navigationMocks.refresh,
  }),
}));

const account = {
  phone: '09121234567',
  roleLabel: 'ادمین عملیات',
  initials: 'اد',
};

const user: AdminCurrentUser = {
  id: 'admin-1',
  phone: '09121234567',
  roles: ['ADMIN'],
  permissions: ['orders.read', 'catalog.read', 'inventory.read'],
};

function renderShell() {
  return render(
    <AdminShell account={account} navigation={getAdminNavigation(user)}>
      <main>محتوای صفحه</main>
    </AdminShell>,
  );
}

describe('AdminShell', () => {
  afterEach(() => {
    navigationMocks.pathname = '/products';
    navigationMocks.replace.mockReset();
    navigationMocks.refresh.mockReset();
    vi.unstubAllGlobals();
  });

  it('renders desktop, mobile and breadcrumb navigation with the active section', () => {
    renderShell();

    expect(screen.getByTestId('desktop-admin-sidebar')).toHaveClass('hidden', 'lg:flex');
    expect(screen.getByTestId('desktop-admin-sidebar')).toHaveClass('right-0');
    expect(screen.getByTestId('desktop-admin-sidebar').parentElement).toHaveClass('lg:pr-72');
    expect(screen.getByTestId('mobile-admin-navigation')).toHaveClass('lg:hidden');
    expect(screen.getByRole('navigation', { name: 'مسیر صفحه' })).toHaveTextContent('محصولات');
    expect(screen.getAllByRole('link', { name: 'محصولات' })).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'محصولات' })).toHaveAttribute('aria-current', 'page');
  });

  it('opens and closes the mobile drawer without exposing unauthorized modules', async () => {
    renderShell();

    fireEvent.click(screen.getByRole('button', { name: 'بازکردن منوی مدیریت' }));
    expect(await screen.findByRole('dialog', { name: 'منوی مدیریت' })).toHaveClass('right-0');
    expect(screen.queryByRole('link', { name: 'پرداخت و مالی' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'بستن منوی مدیریت' }));
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'منوی مدیریت' })).not.toBeInTheDocument(),
    );
  });

  it('logs out through the BFF and redirects to login', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    renderShell();

    fireEvent.click(screen.getByRole('button', { name: 'بازکردن منوی مدیریت' }));
    fireEvent.click(await screen.findByRole('button', { name: 'خروج از حساب' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/auth/logout', { method: 'POST' });
      expect(navigationMocks.replace).toHaveBeenCalledWith('/login');
      expect(navigationMocks.refresh).toHaveBeenCalledOnce();
    });
  });
});
