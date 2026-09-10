import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import BrandsPage from '@/app/(shop)/brands/page';

const catalogMocks = vi.hoisted(() => ({
  getPublicCatalogBrands: vi.fn(),
}));

vi.mock('@/lib/catalog/public-catalog', () => ({
  getPublicCatalogBrands: catalogMocks.getPublicCatalogBrands,
}));

describe('BrandsPage', () => {
  it('uses the brand hero for cards and never falls back to the logo', async () => {
    catalogMocks.getPublicCatalogBrands.mockResolvedValue([
      {
        id: 'brand-1',
        name: 'کارتیر',
        slug: 'cartier',
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
          width: 1600,
          height: 1200,
        },
      },
      {
        id: 'brand-2',
        name: 'برند بدون Hero',
        slug: 'without-hero',
        image: {
          url: 'https://media.hamidian.test/brands/logo-only.webp',
          mimeType: 'image/webp',
          altText: 'لوگوی برند',
          width: 400,
          height: 200,
        },
        heroImage: null,
      },
    ]);

    render(await BrandsPage());

    expect(screen.getByRole('img', { name: 'کالکشن کارتیر' })).toHaveAttribute(
      'src',
      'https://media.hamidian.test/brands/cartier-hero.webp',
    );
    expect(screen.queryByRole('img', { name: /لوگوی/ })).not.toBeInTheDocument();
    expect(screen.getAllByText('برند بدون Hero')).toHaveLength(2);
  });
});
