import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { StorefrontBreadcrumbs } from '@/components/seo/storefront-breadcrumbs';

describe('StorefrontBreadcrumbs', () => {
  it('renders accessible navigation and BreadcrumbList JSON-LD', () => {
    const { container } = render(
      <StorefrontBreadcrumbs
        items={[
          { label: 'خانه', href: '/' },
          { label: 'محصولات', href: '/products' },
          { label: 'انگشتر نقره', href: '/products/silver-ring' },
        ]}
      />,
    );

    expect(screen.getByRole('navigation', { name: 'مسیر صفحه' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'خانه' })).toHaveAttribute('href', '/');
    expect(screen.getByText('انگشتر نقره')).toHaveAttribute('aria-current', 'page');

    const data = JSON.parse(
      container.querySelector('script[type="application/ld+json"]')?.textContent ?? '{}',
    );
    expect(data).toMatchObject({
      '@type': 'BreadcrumbList',
      itemListElement: [
        { position: 1, name: 'خانه' },
        { position: 2, name: 'محصولات' },
        { position: 3, name: 'انگشتر نقره' },
      ],
    });
  });
});
