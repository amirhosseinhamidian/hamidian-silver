'use client';

import { FiHeart } from 'react-icons/fi';

import { trackWishlistChange } from '@/lib/analytics/commerce-events';
import type { WishlistItem } from '@/lib/wishlist/wishlist-state';
import { useWishlist } from '@/lib/wishlist/wishlist-store';

type CatalogWishlistButtonProps = Readonly<{
  item: WishlistItem;
}>;

export function CatalogWishlistButton({ item }: CatalogWishlistButtonProps) {
  const { hasItem, toggleItem } = useWishlist();
  const active = hasItem(item.productId);
  const label = active ? 'حذف از علاقه‌مندی‌ها' : 'افزودن به علاقه‌مندی‌ها';

  function handleToggle() {
    toggleItem(item);
    trackWishlistChange(
      {
        itemId: item.slug,
        itemName: item.name,
        brand: item.brandName,
        priceToman: item.salePriceToman,
        quantity: 1,
      },
      !active,
    );
  }

  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={label}
      onClick={handleToggle}
      className="
        sf-catalog-card__wishlist absolute right-2 top-2 z-20 inline-flex
        size-8 items-center justify-center rounded-full border border-transparent
        bg-transparent text-[var(--sf-color-ink)] shadow-none outline-none
        hover:border-[var(--sf-color-ink)]
        focus-visible:border-[var(--sf-color-ink)]
        sm:right-3 sm:top-3 sm:size-11 sm:border-[var(--sf-color-border)]
        sm:bg-[var(--sf-color-canvas)] sm:shadow-sm
      "
    >
      <FiHeart
        aria-hidden="true"
        className="size-4 sm:size-[21px]"
        fill={active ? 'currentColor' : 'none'}
      />
    </button>
  );
}
