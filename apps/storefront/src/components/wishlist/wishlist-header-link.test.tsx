import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { WishlistHeaderLink } from '@/components/wishlist/wishlist-header-link';

const { wishlistStore } = vi.hoisted(() => ({
  wishlistStore: { itemCount: 0 },
}));

vi.mock('@/lib/wishlist/wishlist-store', () => ({
  useWishlist: () => ({
    items: Array.from({ length: wishlistStore.itemCount }, (_, index) => ({
      productId: `product-${index}`,
    })),
  }),
}));

describe('WishlistHeaderLink', () => {
  it('does not show a badge for an empty wishlist', () => {
    wishlistStore.itemCount = 0;

    render(<WishlistHeaderLink />);

    expect(screen.queryByTestId('wishlist-header-count')).not.toBeInTheDocument();
  });

  it('shows the Persian wishlist count up to nine', () => {
    wishlistStore.itemCount = 7;

    render(<WishlistHeaderLink />);

    expect(screen.getByTestId('wishlist-header-count')).toHaveTextContent('۷');
  });

  it('caps wishlist counts greater than nine at +۹', () => {
    wishlistStore.itemCount = 12;

    render(<WishlistHeaderLink />);

    expect(screen.getByTestId('wishlist-header-count')).toHaveTextContent('+۹');
  });
});
