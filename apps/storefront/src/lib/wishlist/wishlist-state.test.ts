import { describe, expect, it } from 'vitest';

import {
  deserializeWishlist,
  isWishlistItem,
  serializeWishlist,
  toggleWishlistItem,
  type WishlistItem,
} from './wishlist-state';

const item: WishlistItem = {
  productId: 'product-1',
  slug: 'silver-ring-azar',
  name: 'انگشتر نقره آذر',
  brandName: 'Hamidian Studio',
  media: null,
  salePriceToman: 3_200_000,
};

describe('wishlist state', () => {
  it('toggles one product without duplicates', () => {
    const added = toggleWishlistItem([], item);

    expect(isWishlistItem(added, item.productId)).toBe(true);
    expect(toggleWishlistItem(added, item)).toEqual([]);
  });

  it('round-trips valid stored items and ignores invalid entries', () => {
    const serialized = serializeWishlist([item]);

    expect(deserializeWishlist(serialized)).toEqual([item]);
    expect(deserializeWishlist('[{"productId":42}]')).toEqual([]);
  });
});
