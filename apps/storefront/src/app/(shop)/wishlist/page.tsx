'use client';

import Link from 'next/link';

import { CatalogMedia } from '@/components/catalog/catalog-media';
import { Button, ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { formatTomanPrice } from '@/lib/catalog/presentation';
import { useWishlist } from '@/lib/wishlist/wishlist-store';

export default function WishlistPage() {
  const { items, toggleItem } = useWishlist();

  if (items.length === 0) {
    return (
      <main id="main-content" className="sf-container pb-[var(--sf-section-space)] pt-8 sm:pt-10">
        <EmptyState
          title="فهرست علاقه‌مندی‌های شما خالی است"
          description="از صفحه هر محصول می‌توانید آن را برای مراجعه بعدی ذخیره کنید."
          action={
            <ButtonLink href="/products" variant="outline">
              مشاهده محصولات
            </ButtonLink>
          }
        />
      </main>
    );
  }

  return (
    <main id="main-content" className="sf-container pb-[var(--sf-section-space)] pt-8 sm:pt-10">
      <header className="border-b border-[var(--sf-color-border)] pb-7">
        <p className="text-sm text-[var(--sf-color-muted)]">محصولات ذخیره‌شده</p>
        <h1 className="mt-2 text-4xl font-normal sm:text-5xl">علاقه‌مندی‌ها</h1>
      </header>

      <ul className="grid gap-6 py-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((item) => (
          <li key={item.productId} className="flex min-w-0 flex-col">
            <Link
              href={`/products/${item.slug}`}
              className="aspect-square overflow-hidden bg-[var(--sf-color-surface)]"
            >
              <CatalogMedia
                media={item.media}
                fallbackSrc={
                  process.env.NODE_ENV === 'development'
                    ? `/dev-catalog/products/${item.slug}.webp`
                    : null
                }
                alt={item.name}
              />
            </Link>
            <div className="pt-4">
              {item.brandName ? (
                <p className="text-xs text-[var(--sf-color-subtle)]">{item.brandName}</p>
              ) : null}
              <Link href={`/products/${item.slug}`} className="mt-1 block text-base font-medium">
                {item.name}
              </Link>
              <p className="mt-2 text-sm">{formatTomanPrice(item.salePriceToman)}</p>
              <Button
                type="button"
                variant="text"
                size="sm"
                className="mt-3"
                onClick={() => toggleItem(item)}
              >
                حذف از علاقه‌مندی‌ها
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
