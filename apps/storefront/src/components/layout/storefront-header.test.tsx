import type { StorefrontAnnouncement } from '@/components/layout/storefront-announcement';
import {
  StorefrontHeader,
  type StorefrontNavigationCategory,
} from '@/components/layout/storefront-header';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AUTHENTICATION_ENDED_EVENT, AUTHENTICATION_SUCCEEDED_EVENT } from '@/lib/auth/events';

const navigationCategories: StorefrontNavigationCategory[] = [
  { id: 'category-ring', label: 'انگشتر', slug: 'rings' },
  { id: 'category-necklace', label: 'گردنبند', slug: 'necklaces' },
];

const announcement: StorefrontAnnouncement = {
  enabled: true,
  message: 'فروش ویژه پایان فصل',
  countdown: {
    mode: 'fixed',
    durationSeconds: 5400,
  },
  cta: {
    enabled: true,
    label: 'مشاهده محصولات',
    href: '/products',
  },
};

describe('StorefrontHeader', () => {
  it('renders the storefront identity, icon actions, and configured categories', () => {
    render(
      <StorefrontHeader announcement={announcement} navigationCategories={navigationCategories} />,
    );

    expect(screen.getByText('فروش ویژه پایان فصل')).toBeInTheDocument();
    expect(screen.getByLabelText('شمارش معکوس')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'مشاهده محصولات' })).toHaveAttribute(
      'href',
      '/products',
    );
    expect(screen.getByRole('img', { name: 'لوگوی نقره حمیدیان' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'علاقه‌مندی‌ها' })).toHaveAttribute(
      'href',
      '/wishlist',
    );
    expect(screen.getAllByRole('button', { name: 'ورود یا ثبت‌نام' })).toHaveLength(2);
    expect(screen.getAllByRole('link', { name: 'سبد خرید' })).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'جستجو در محصولات' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'باز کردن منوی موبایل' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'سوالات متداول' })).toHaveAttribute('href', '/faq');
    expect(screen.getByRole('link', { name: 'نقره حمیدیان، صفحه اصلی موبایل' })).toHaveAttribute(
      'href',
      '/',
    );

    expect(screen.getByRole('banner')).toHaveClass('sticky', 'top-0');

    const navigation = screen.getByRole('navigation', { name: 'پیمایش اصلی' });
    expect(navigation).toHaveClass('lg:col-start-2', 'lg:justify-self-center');
    expect(screen.getByTestId('storefront-header-search-slot')).toHaveClass(
      'lg:col-start-3',
      'lg:justify-self-end',
    );
    expect(screen.getByText('فروش ویژه پایان فصل').parentElement).toHaveClass(
      'text-sm',
      'leading-6',
    );

    expect(within(navigation).getByRole('link', { name: 'خانه' })).toHaveAttribute('href', '/');
    expect(within(navigation).getByRole('link', { name: 'انگشتر' })).toHaveAttribute(
      'href',
      '/categories/rings',
    );
    expect(within(navigation).getByRole('link', { name: 'گردنبند' })).toHaveAttribute(
      'href',
      '/categories/necklaces',
    );
    expect(within(navigation).getByRole('link', { name: 'برندها' })).toHaveAttribute(
      'href',
      '/brands',
    );
    expect(within(navigation).getByRole('link', { name: 'جدیدترین‌ها' })).toHaveAttribute(
      'href',
      '/products?sort=newest',
    );
  });

  it('does not invent dynamic content when storefront configuration is unavailable', () => {
    render(<StorefrontHeader />);

    expect(screen.queryByLabelText('شمارش معکوس')).not.toBeInTheDocument();
    expect(screen.queryByText('فروش ویژه پایان فصل')).not.toBeInTheDocument();

    const navigation = screen.getByRole('navigation', { name: 'پیمایش اصلی' });

    expect(within(navigation).queryByRole('link', { name: 'انگشتر' })).not.toBeInTheDocument();
    expect(within(navigation).queryByRole('link', { name: 'گردنبند' })).not.toBeInTheDocument();
  });

  it('links authenticated customers directly to their account', () => {
    render(<StorefrontHeader authenticated />);

    expect(screen.getAllByRole('link', { name: 'حساب کاربری' })).toHaveLength(2);
    for (const link of screen.getAllByRole('link', { name: 'حساب کاربری' })) {
      expect(link).toHaveAttribute('href', '/account');
    }
    expect(screen.queryByRole('button', { name: 'ورود یا ثبت‌نام' })).not.toBeInTheDocument();
  });

  it('updates account actions when authentication changes without a page reload', () => {
    render(<StorefrontHeader />);

    expect(screen.getAllByRole('button', { name: 'ورود یا ثبت‌نام' })).toHaveLength(2);

    fireEvent(window, new Event(AUTHENTICATION_SUCCEEDED_EVENT));
    expect(screen.getAllByRole('link', { name: 'حساب کاربری' })).toHaveLength(2);

    fireEvent(window, new Event(AUTHENTICATION_ENDED_EVENT));
    expect(screen.getAllByRole('button', { name: 'ورود یا ثبت‌نام' })).toHaveLength(2);
  });

  it('opens a product search form that submits the query to the catalog', () => {
    render(<StorefrontHeader />);

    fireEvent.click(screen.getByRole('button', { name: 'جستجو در محصولات' }));

    const searchForm = screen.getByRole('search');
    const searchInput = within(searchForm).getByRole('combobox', { name: 'نام محصول' });

    expect(searchForm).toHaveAttribute('action', '/products');
    expect(searchForm).toHaveAttribute('method', 'get');
    expect(searchInput).toHaveAttribute('name', 'q');
    expect(searchInput).toHaveAttribute('maxlength', '100');
    expect(within(searchForm).getByRole('button', { name: 'اجرای جستجو' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'بستن جستجو' })).toBeInTheDocument();
  });

  it('opens mobile navigation with configured categories and utility links', () => {
    render(<StorefrontHeader navigationCategories={navigationCategories} />);

    fireEvent.click(screen.getByRole('button', { name: 'باز کردن منوی موبایل' }));

    const mobileNavigation = screen.getByRole('navigation', { name: 'منوی موبایل' });

    expect(within(mobileNavigation).getByRole('link', { name: 'خانه' })).toHaveAttribute(
      'href',
      '/',
    );
    expect(within(mobileNavigation).getByRole('link', { name: 'انگشتر' })).toHaveAttribute(
      'href',
      '/categories/rings',
    );
    expect(within(mobileNavigation).getByRole('link', { name: 'علاقه‌مندی‌ها' })).toHaveAttribute(
      'href',
      '/wishlist',
    );
    expect(within(mobileNavigation).getByRole('link', { name: 'سوالات متداول' })).toHaveAttribute(
      'href',
      '/faq',
    );
    expect(screen.getByRole('button', { name: 'بستن منوی موبایل' })).toBeInTheDocument();
  });
});
