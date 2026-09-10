import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import ProductDetailPage from '@/app/(shop)/products/[slug]/page';
import { formatTomanPrice } from '@/lib/catalog/presentation';
import type { PublicCatalogProductDetail } from '@/lib/catalog/public-catalog';

const { getPublicCatalogProduct, getPublicSeoRedirect, permanentRedirect } = vi.hoisted(() => ({
  getPublicCatalogProduct: vi.fn(),
  getPublicSeoRedirect: vi.fn(),
  permanentRedirect: vi.fn((destinationPath: string) => {
    throw new Error(`NEXT_REDIRECT:${destinationPath}`);
  }),
}));

vi.mock('@/lib/catalog/public-catalog', () => ({
  getPublicCatalogProduct,
}));

vi.mock('@/lib/seo/redirects', () => ({
  getPublicSeoRedirect,
}));

vi.mock('next/navigation', () => ({
  notFound: vi.fn(),
  permanentRedirect,
}));

vi.mock('@/components/cart/product-purchase-panel', () => ({
  ProductPurchasePanel: () => null,
}));

vi.mock('@/components/wishlist/wishlist-button', () => ({
  WishlistButton: ({
    item,
  }: {
    item: {
      compareAtPriceToman: number | null;
    };
  }) => (
    <span data-testid="wishlist-snapshot" data-compare-at-price={item.compareAtPriceToman ?? ''} />
  ),
}));

const product: PublicCatalogProductDetail = {
  id: '10000000-0000-4000-8000-000000000010',
  name: 'انگشتر نقره',
  slug: 'silver-ring',
  shortDescription: null,
  description: null,
  salePriceToman: 800_000,
  compareAtPriceToman: 1_000_000,
  sizeMode: 'SIZED',
  brand: null,
  categories: [],
  primaryMedia: null,
  availableQuantity: 3,
  isAvailable: true,
  country: null,
  media: [],
  variants: [],
};

describe('ProductDetailPage', () => {
  it('shows only the numeric percentage beside discounted product prices', async () => {
    getPublicCatalogProduct.mockResolvedValue(product);

    const { container } = render(
      await ProductDetailPage({
        params: Promise.resolve({ slug: product.slug }),
      }),
    );

    expect(screen.getByText(formatTomanPrice(1_000_000))).toHaveClass('line-through');
    expect(screen.getByText(formatTomanPrice(800_000))).toBeInTheDocument();
    expect(screen.getByText('۲۰٪')).toHaveClass('bg-[var(--sf-color-ink)]', 'text-white');
    expect(screen.queryByText(/تخفیف/)).not.toBeInTheDocument();
    expect(screen.getByTestId('wishlist-snapshot')).toHaveAttribute(
      'data-compare-at-price',
      '1000000',
    );
    const structuredData = [...container.querySelectorAll('script[type="application/ld+json"]')]
      .map((script) => JSON.parse(script.textContent ?? '{}'))
      .find((value: unknown) =>
        typeof value === 'object' && value !== null && '@type' in value
          ? value['@type'] === 'Product'
          : false,
      );
    expect(structuredData).toMatchObject({
      name: product.name,
      offers: {
        priceCurrency: 'IRR',
        price: 8_000_000,
        availability: 'https://schema.org/InStock',
      },
    });
  });

  it('permanently redirects a historical product slug to its current path', async () => {
    getPublicCatalogProduct.mockResolvedValue(null);
    getPublicSeoRedirect.mockResolvedValue('/products/new-ring');

    await expect(
      ProductDetailPage({ params: Promise.resolve({ slug: 'old-ring' }) }),
    ).rejects.toThrow('NEXT_REDIRECT:/products/new-ring');
    expect(permanentRedirect).toHaveBeenCalledWith('/products/new-ring');
  });
});
