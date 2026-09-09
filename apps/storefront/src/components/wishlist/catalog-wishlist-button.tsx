'use client';

import { FiHeart } from 'react-icons/fi';

import type { WishlistItem } from '@/lib/wishlist/wishlist-state';
import { useWishlist } from '@/lib/wishlist/wishlist-store';

type CatalogWishlistButtonProps = Readonly<{
  item: WishlistItem;
}>;

export function CatalogWishlistButton({ item }: CatalogWishlistButtonProps) {
  const { hasItem, toggleItem } = useWishlist();
  const active = hasItem(item.productId);
  const label = active ? 'حذف از علاقه‌مندی‌ها' : 'افزودن به علاقه‌مندی‌ها';

  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={label}
      onClick={() => toggleItem(item)}
      className="
        sf-catalog-card__wishlist absolute right-3 top-3 z-20 inline-flex
        size-11 items-center justify-center rounded-full border
        border-[var(--sf-color-border)] bg-[var(--sf-color-canvas)]
        text-[var(--sf-color-ink)] shadow-sm outline-none
        hover:border-[var(--sf-color-ink)]
        focus-visible:border-[var(--sf-color-ink)]
      "
    >
      <FiHeart aria-hidden="true" size={21} fill={active ? 'currentColor' : 'none'} />
    </button>
  );
}
