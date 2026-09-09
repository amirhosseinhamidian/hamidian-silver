import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import BrandPage from '@/app/(shop)/brands/[slug]/page';

const catalogMocks = vi.hoisted(() => ({
  getPublicCatalogBrands: vi.fn(),
  getPublicCatalogProducts: vi.fn(),
}));

vi.mock('@/lib/catalog/public-catalog', () => ({
  getPublicCatalogBrands: catalogMocks.getPublicCatalogBrands,
  getPublicCatalogProducts: catalogMocks.getPublicCatalogProducts,
  parseCatalogSearchParams: () => ({ page: 1, pageSize: 24, sort: 'newest' }),
}));

vi.mock('@/components/catalog/catalog-collection-page', () => ({
  CatalogCollectionPage: ({ image }: { image: { url: string } | null }) => (
    <div data-testid="brand-collection" data-hero-src={image?.url ?? ''} />
  ),
}));

describe('BrandPage', () => {
  it('uses the brand hero and never its logo as collection media', async () => {
    catalogMocks.getPublicCatalogBrands.mockResolvedValue([
      {
        id: 'brand-1',
        name: 'کارتیر',
        slug: 'cartier',
        description: null,
        image: {
          url: 'https://media.hamidian.test/brands/cartier-logo.webp',
          mimeType: 'image/webp',
          altText: 'لوگوی کارتیر',
          width: 400,
          height: 200,
        },
        heroImage: {
          url: 'https://media.hamidian.test/brands/cartier-hero.webp',
          mimeType: 'image/webp',
          altText: 'کالکشن کارتیر',
          width: 1920,
          height: 900,
        },
        originCountry: null,
      },
    ]);
    catalogMocks.getPublicCatalogProducts.mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 24,
      total: 0,
      totalPages: 0,
    });

    render(
      await BrandPage({
        params: Promise.resolve({ slug: 'cartier' }),
        searchParams: Promise.resolve({}),
      }),
    );

    expect(screen.getByTestId('brand-collection')).toHaveAttribute(
      'data-hero-src',
      'https://media.hamidian.test/brands/cartier-hero.webp',
    );
  });
});
