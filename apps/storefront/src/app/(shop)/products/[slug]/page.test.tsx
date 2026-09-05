import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import ProductDetailPage from '@/app/(shop)/products/[slug]/page';
import { formatTomanPrice } from '@/lib/catalog/presentation';
import type { PublicCatalogProductDetail } from '@/lib/catalog/public-catalog';

const { getPublicCatalogProduct } = vi.hoisted(() => ({
  getPublicCatalogProduct: vi.fn(),
}));

vi.mock('@/lib/catalog/public-catalog', () => ({
  getPublicCatalogProduct,
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

    render(
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
  });
});
