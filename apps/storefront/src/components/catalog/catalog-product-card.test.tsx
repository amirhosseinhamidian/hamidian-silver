import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CatalogProductCard } from '@/components/catalog/catalog-product-card';
import { formatTomanPrice } from '@/lib/catalog/presentation';
import type { PublicCatalogProductSummary } from '@/lib/catalog/public-catalog';

const { hasItem, toggleItem } = vi.hoisted(() => ({
  hasItem: vi.fn(),
  toggleItem: vi.fn(),
}));

vi.mock('@/lib/wishlist/wishlist-store', () => ({
  useWishlist: () => ({ hasItem, toggleItem }),
}));

const product: PublicCatalogProductSummary = {
  id: '10000000-0000-4000-8000-000000000010',
  name: 'انگشتر نقره',
  slug: 'silver-ring',
  shortDescription: null,
  salePriceToman: 800_000,
  compareAtPriceToman: 1_000_000,
  sizeMode: 'SIZED',
  brand: null,
  categories: [],
  primaryMedia: null,
  availableQuantity: 3,
  isAvailable: true,
};

describe('CatalogProductCard', () => {
  beforeEach(() => {
    hasItem.mockReset();
    hasItem.mockReturnValue(false);
    toggleItem.mockReset();
  });

  it('shows the compare price, sale price, and percentage without a discount label', () => {
    render(<CatalogProductCard product={product} />);

    expect(screen.getByText(formatTomanPrice(1_000_000))).toHaveClass('line-through');
    expect(screen.getByText(formatTomanPrice(800_000))).toBeInTheDocument();
    expect(screen.getByText('۲۰٪')).toHaveClass('bg-[var(--sf-color-ink)]', 'text-white');
    expect(screen.queryByText(/تخفیف/)).not.toBeInTheDocument();
  });

  it('does not show discount presentation when the compare price is not higher', () => {
    render(
      <CatalogProductCard
        product={{
          ...product,
          compareAtPriceToman: 800_000,
        }}
      />,
    );

    expect(screen.queryByText('۰٪')).not.toBeInTheDocument();
    expect(screen.getAllByText(formatTomanPrice(800_000))).toHaveLength(1);
  });

  it('labels an unavailable product without presenting a purchase action', () => {
    render(
      <CatalogProductCard
        product={{
          ...product,
          availableQuantity: 0,
          isAvailable: false,
        }}
      />,
    );

    expect(screen.getByText('ناموجود')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'مشاهده محصول' })).toHaveAttribute(
      'href',
      '/products/silver-ring',
    );
    expect(screen.queryByRole('link', { name: 'مشاهده و خرید' })).not.toBeInTheDocument();
  });

  it('renders an optional merchandising badge', () => {
    render(<CatalogProductCard product={product} badge="جدید" />);

    expect(screen.getByText('جدید')).toHaveClass('bg-[var(--sf-color-ink)]', 'text-white');
  });

  it('offers a card wishlist action with the current product snapshot', () => {
    render(<CatalogProductCard product={product} />);

    const button = screen.getByRole('button', { name: 'افزودن به علاقه‌مندی‌ها' });
    expect(button).toHaveClass('sf-catalog-card__wishlist');
    expect(button).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(button);

    expect(toggleItem).toHaveBeenCalledWith({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      brandName: null,
      media: null,
      salePriceToman: product.salePriceToman,
      compareAtPriceToman: product.compareAtPriceToman,
    });
  });

  it('shows a filled removal action when the product is already saved', () => {
    hasItem.mockReturnValue(true);

    render(<CatalogProductCard product={product} />);

    const button = screen.getByRole('button', { name: 'حذف از علاقه‌مندی‌ها' });
    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(button.querySelector('svg')).toHaveAttribute('fill', 'currentColor');
  });
});
