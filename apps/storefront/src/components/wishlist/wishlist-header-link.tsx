'use client';

import Link from 'next/link';

import { WishlistHeartIcon } from '@/components/wishlist/wishlist-heart-icon';
import { useWishlist } from '@/lib/wishlist/wishlist-store';

export function WishlistHeaderLink() {
  const { items } = useWishlist();
  const itemCount = items.length;
  const badgeLabel = itemCount > 9 ? '+۹' : itemCount.toLocaleString('fa-IR');

  return (
    <Link
      href="/wishlist"
      aria-label="علاقه‌مندی‌ها"
      className="relative inline-flex size-9 items-center justify-center transition-opacity duration-150 hover:opacity-55"
    >
      <WishlistHeartIcon active={itemCount > 0} className="size-[21px]" />
      {itemCount > 0 ? (
        <span
          dir="ltr"
          aria-hidden="true"
          data-testid="wishlist-header-count"
          className="
            absolute -right-1 -top-1 flex min-w-4 items-center justify-center rounded-full
            bg-[var(--sf-color-ink)] px-1 text-[0.6rem] font-semibold leading-4
            text-[var(--sf-color-canvas)]
          "
        >
          {badgeLabel}
        </span>
      ) : null}
    </Link>
  );
}
