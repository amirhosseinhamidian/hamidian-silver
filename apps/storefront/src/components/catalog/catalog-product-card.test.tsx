import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { CatalogProductCard } from '@/components/catalog/catalog-product-card';
import { formatTomanPrice } from '@/lib/catalog/presentation';
import type { PublicCatalogProductSummary } from '@/lib/catalog/public-catalog';

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
});
