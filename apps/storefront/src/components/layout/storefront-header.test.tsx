import type { StorefrontAnnouncement } from '@/components/layout/storefront-announcement';
import {
  StorefrontHeader,
  type StorefrontNavigationCategory,
} from '@/components/layout/storefront-header';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

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
      <StorefrontHeader
        announcement={announcement}
        navigationCategories={navigationCategories}
      />,
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
    expect(screen.getByRole('link', { name: 'حساب کاربری' })).toHaveAttribute(
      'href',
      '/account',
    );
    expect(screen.getByRole('link', { name: 'سبد خرید' })).toHaveAttribute('href', '/cart');

    const navigation = screen.getByRole('navigation', { name: 'پیمایش اصلی' });

    expect(within(navigation).getByRole('link', { name: 'خانه' })).toHaveAttribute(
      'href',
      '/',
    );
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
});
