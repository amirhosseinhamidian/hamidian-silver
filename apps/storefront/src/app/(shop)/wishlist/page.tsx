'use client';

import Link from 'next/link';
import { FiTrash2 } from 'react-icons/fi';

import { CatalogMedia } from '@/components/catalog/catalog-media';
import { DiscountBadge } from '@/components/catalog/discount-badge';
import { ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { trackWishlistChange } from '@/lib/analytics/commerce-events';
import { formatTomanPrice } from '@/lib/catalog/presentation';
import { getDiscountPercent } from '@/lib/catalog/pricing';
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

      <ul className="grid grid-cols-2 gap-x-3 gap-y-10 py-8 sm:gap-x-5 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((item) => {
          const discountPercent = getDiscountPercent(item.compareAtPriceToman, item.salePriceToman);

          return (
            <li key={item.productId} className="sf-catalog-card group flex min-w-0 flex-col p-2">
              <div className="relative">
                <Link
                  href={`/products/${item.slug}`}
                  className="
                    sf-catalog-card__media relative block aspect-square overflow-hidden
                    rounded-[var(--sf-radius-md)] bg-[var(--sf-color-surface)]
                  "
                >
                  <CatalogMedia
                    media={item.media}
                    fallbackSrc={
                      process.env.NODE_ENV === 'development'
                        ? `/dev-catalog/products/${item.slug}.webp`
                        : null
                    }
                    alt={item.name}
                    sizes="(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, 50vw"
                  />
                </Link>

                <button
                  type="button"
                  aria-label="حذف از علاقه‌مندی‌ها"
                  title="حذف از علاقه‌مندی‌ها"
                  data-tooltip="حذف از علاقه‌مندی‌ها"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    toggleItem(item);
                    trackWishlistChange(
                      {
                        itemId: item.slug,
                        itemName: item.name,
                        brand: item.brandName,
                        priceToman: item.salePriceToman,
                        quantity: 1,
                      },
                      false,
                    );
                  }}
                  className="
                    sf-catalog-card__wishlist sf-catalog-card__remove absolute left-3 top-3
                    z-20 inline-flex size-11 items-center justify-center rounded-full border
                    border-[var(--sf-color-border)] bg-[var(--sf-color-canvas)]
                    text-[var(--sf-color-ink)] shadow-sm outline-none
                    hover:border-[var(--sf-color-ink)]
                    focus-visible:border-[var(--sf-color-ink)]
                  "
                >
                  <FiTrash2 aria-hidden="true" size={20} />
                </button>
              </div>

              <div className="flex flex-1 flex-col pt-4 text-center">
                {item.brandName ? (
                  <p className="text-[0.7rem] text-[var(--sf-color-subtle)]">{item.brandName}</p>
                ) : null}

                <Link href={`/products/${item.slug}`} className="mt-2 block">
                  <h2 className="text-sm font-medium leading-6 sm:text-base">{item.name}</h2>
                </Link>

                <div className="mt-3 flex flex-col items-center gap-1">
                  {discountPercent !== null ? (
                    <div className="flex items-center gap-2 text-xs text-[var(--sf-color-muted)]">
                      <span className="line-through">
                        {formatTomanPrice(item.compareAtPriceToman)}
                      </span>
                      <DiscountBadge percent={discountPercent} />
                    </div>
                  ) : null}

                  <p className="text-sm font-medium sm:text-base">
                    {formatTomanPrice(item.salePriceToman)}
                  </p>
                </div>

                <div className="sf-catalog-card__action mt-auto pt-4">
                  <ButtonLink href={`/products/${item.slug}`} variant="solid" className="w-full">
                    مشاهده و خرید
                  </ButtonLink>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
