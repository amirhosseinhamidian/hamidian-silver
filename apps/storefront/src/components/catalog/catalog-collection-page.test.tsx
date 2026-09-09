import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CatalogCollectionPage } from '@/components/catalog/catalog-collection-page';

vi.mock('@/lib/catalog/dev-media.server', () => ({
  getCatalogDevProductImageSources: () => ({}),
}));

const filters = {
  page: 1,
  pageSize: 24,
  sort: 'newest' as const,
  brand: 'cartier',
};

const products = {
  items: [],
  page: 1,
  pageSize: 24,
  total: 0,
  totalPages: 0,
};

describe('CatalogCollectionPage', () => {
  it('uses collection media as a full-width hero background', () => {
    render(
      <CatalogCollectionPage
        path="/brands/cartier"
        eyebrow="برند"
        title="کارتیر"
        description="زیورآلات منتخب کارتیر"
        image={{
          url: 'https://media.hamidian.test/brands/cartier-hero.webp',
          mimeType: 'image/webp',
          altText: 'کالکشن کارتیر',
          width: 1920,
          height: 900,
        }}
        filters={filters}
        products={products}
      />,
    );

    const heroImage = screen.getByRole('img', { name: 'کالکشن کارتیر' });
    expect(heroImage).toHaveAttribute(
      'src',
      'https://media.hamidian.test/brands/cartier-hero.webp',
    );
    expect(heroImage.parentElement?.parentElement).toHaveClass('min-h-[18rem]');
    expect(screen.getByRole('heading', { name: 'کارتیر' })).toBeInTheDocument();
    expect(screen.getByText('۰ محصول')).toBeInTheDocument();
  });
});
