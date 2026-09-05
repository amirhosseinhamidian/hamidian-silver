'use client';

import { useState, type ReactNode } from 'react';
import { FiHeart, FiShare2 } from 'react-icons/fi';

import { Button } from '@/components/ui/button';
import type { WishlistItem } from '@/lib/wishlist/wishlist-state';
import { useWishlist } from '@/lib/wishlist/wishlist-store';

type WishlistButtonProps = Readonly<{
  item: WishlistItem;
}>;

type IconActionProps = Readonly<{
  label: string;
  pressed?: boolean;
  onClick: () => void | Promise<void>;
  children: ReactNode;
}>;

function IconAction({ label, pressed, onClick, children }: IconActionProps) {
  return (
    <span className="group relative inline-flex">
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label={label}
        aria-pressed={pressed}
        onClick={onClick}
      >
        {children}
      </Button>
      <span
        aria-hidden="true"
        className="
          pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden
          -translate-x-1/2 whitespace-nowrap bg-[var(--sf-color-ink)] px-2.5 py-1.5
          text-[0.68rem] text-white opacity-0 transition-opacity duration-150
          group-hover:opacity-100 group-focus-within:opacity-100 lg:block
        "
      >
        {label}
      </span>
    </span>
  );
}

export function WishlistButton({ item }: WishlistButtonProps) {
  const { hasItem, toggleItem } = useWishlist();
  const active = hasItem(item.productId);
  const [shareLabel, setShareLabel] = useState('اشتراک‌گذاری محصول');
  const wishlistLabel = active ? 'حذف از علاقه‌مندی‌ها' : 'افزودن به علاقه‌مندی‌ها';

  async function handleShare() {
    const url = window.location.href;

    try {
      if (navigator.share) {
        await navigator.share({ title: item.name, url });
        return;
      }

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        setShareLabel('لینک کپی شد');
        window.setTimeout(() => setShareLabel('اشتراک‌گذاری محصول'), 1800);
        return;
      }

      setShareLabel('امکان اشتراک‌گذاری در دسترس نیست');
      window.setTimeout(() => setShareLabel('اشتراک‌گذاری محصول'), 1800);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }

      setShareLabel('اشتراک‌گذاری انجام نشد');
      window.setTimeout(() => setShareLabel('اشتراک‌گذاری محصول'), 1800);
    }
  }

  return (
    <div role="group" className="flex items-center gap-2" aria-label="اقدامات محصول">
      <IconAction label={wishlistLabel} pressed={active} onClick={() => toggleItem(item)}>
        <FiHeart aria-hidden="true" size={20} fill={active ? 'currentColor' : 'none'} />
      </IconAction>
      <IconAction label={shareLabel} onClick={handleShare}>
        <FiShare2 aria-hidden="true" size={19} />
      </IconAction>
    </div>
  );
}
