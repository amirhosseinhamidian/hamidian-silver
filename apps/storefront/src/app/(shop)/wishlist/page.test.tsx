import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import WishlistPage from '@/app/(shop)/wishlist/page';
import { formatTomanPrice } from '@/lib/catalog/presentation';
import type { WishlistItem } from '@/lib/wishlist/wishlist-state';

const { toggleItem, wishlistItem } = vi.hoisted(() => ({
  toggleItem: vi.fn(),
  wishlistItem: {
    productId: 'product-1',
    slug: 'silver-ring-azar',
    name: 'انگشتر نقره آذر',
    brandName: 'Hamidian Studio',
    media: null,
    salePriceToman: 3_200_000,
    compareAtPriceToman: 4_000_000,
  },
}));

const item: WishlistItem = wishlistItem;

vi.mock('@/lib/wishlist/wishlist-store', () => ({
  useWishlist: () => ({
    items: [wishlistItem],
    toggleItem,
  }),
}));

describe('WishlistPage', () => {
  it('matches catalog cards and removes the selected snapshot from the icon action', () => {
    render(<WishlistPage />);

    expect(screen.getByText(formatTomanPrice(4_000_000))).toHaveClass('line-through');
    expect(screen.getByText(formatTomanPrice(3_200_000))).toBeInTheDocument();
    expect(screen.getByText('۲۰٪')).toHaveClass('bg-[var(--sf-color-ink)]', 'text-white');
    expect(screen.queryByText(/تخفیف/)).not.toBeInTheDocument();

    const removeButton = screen.getByRole('button', { name: 'حذف از علاقه‌مندی‌ها' });
    expect(removeButton).toHaveClass(
      'sf-catalog-card__wishlist',
      'sf-catalog-card__remove',
      'left-3',
    );
    expect(removeButton).toHaveAttribute('title', 'حذف از علاقه‌مندی‌ها');
    expect(removeButton).toHaveAttribute('data-tooltip', 'حذف از علاقه‌مندی‌ها');
    expect(removeButton.closest('a')).toBeNull();
    expect(screen.getByRole('link', { name: 'مشاهده و خرید' })).toHaveAttribute(
      'href',
      '/products/silver-ring-azar',
    );

    fireEvent.click(removeButton);
    expect(toggleItem).toHaveBeenCalledWith(item);
  });
});
