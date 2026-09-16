import Link from 'next/link';

import { CatalogMedia } from '@/components/catalog/catalog-media';
import { DiscountBadge } from '@/components/catalog/discount-badge';
import { ButtonLink } from '@/components/ui/button';
import { CatalogWishlistButton } from '@/components/wishlist/catalog-wishlist-button';
import type { PublicCatalogProductSummary } from '@/lib/catalog/public-catalog';
import { formatTomanPrice } from '@/lib/catalog/presentation';
import { getDiscountPercent } from '@/lib/catalog/pricing';

type CatalogProductCardProps = Readonly<{
  product: PublicCatalogProductSummary;
  fallbackSrc?: string | null;
  badge?: string | null;
  imageSizes?: string;
}>;

export function CatalogProductCard({
  product,
  fallbackSrc = null,
  badge = null,
  imageSizes = '(min-width: 1024px) 25vw, 50vw',
}: CatalogProductCardProps) {
  const wishlistItem = {
    productId: product.id,
    slug: product.slug,
    name: product.name,
    brandName: product.brand?.name ?? null,
    media: product.primaryMedia,
    salePriceToman: product.salePriceToman,
    compareAtPriceToman: product.compareAtPriceToman,
  };

  return (
    <li className="sf-catalog-card group flex min-w-0 flex-col p-1 sm:p-2">
      <div className="relative">
        <Link
          href={`/products/${product.slug}`}
          className="
            sf-catalog-card__media relative block aspect-square overflow-hidden
            rounded-[var(--sf-radius-md)] bg-[var(--sf-color-surface)]
          "
        >
          <CatalogMedia
            media={product.primaryMedia}
            fallbackSrc={fallbackSrc}
            alt={product.name}
            sizes={imageSizes}
          />
          {badge ? (
            <span className="absolute left-2 top-2 bg-[var(--sf-color-ink)] px-1.5 py-0.5 text-[0.625rem] text-white sm:left-3 sm:top-3 sm:px-2.5 sm:py-1 sm:text-xs">
              {badge}
            </span>
          ) : null}
          {!product.isAvailable ? (
            <span
              className={`
                absolute left-3 rounded-full bg-[var(--sf-color-canvas)] px-3 py-1
                text-xs text-[var(--sf-color-ink)] shadow-sm
                ${badge ? 'top-12' : 'top-3'}
              `}
            >
              ناموجود
            </span>
          ) : null}
        </Link>

        <CatalogWishlistButton item={wishlistItem} />
      </div>

      <div className="flex flex-1 flex-col pt-3 text-center sm:pt-4">
        {product.brand ? (
          <p className="text-[0.7rem] text-[var(--sf-color-subtle)]">{product.brand.name}</p>
        ) : null}

        <Link href={`/products/${product.slug}`} className="mt-2 block">
          <h2 className="text-xs font-medium leading-5 sm:text-base sm:leading-6">{product.name}</h2>
        </Link>

        {product.shortDescription ? (
          <p
            className="
              mx-auto mt-2 line-clamp-2 max-w-sm text-[0.6875rem] leading-5
              text-[var(--sf-color-muted)] sm:text-sm sm:leading-6
            "
          >
            {product.shortDescription}
          </p>
        ) : null}

        <div className="mt-3 flex flex-col items-center gap-1">
          {product.compareAtPriceToman &&
          product.salePriceToman &&
          product.compareAtPriceToman > product.salePriceToman ? (
            <div className="flex items-center gap-2 text-xs text-[var(--sf-color-muted)]">
              <span className="line-through">{formatTomanPrice(product.compareAtPriceToman)}</span>

              <DiscountBadge
                percent={getDiscountPercent(product.compareAtPriceToman, product.salePriceToman)!}
              />
            </div>
          ) : null}

          <p className="text-xs font-medium sm:text-base">
            {formatTomanPrice(product.salePriceToman)}
          </p>
        </div>

        <div className="sf-catalog-card__action mt-auto pt-3 sm:pt-4">
          <ButtonLink
            href={`/products/${product.slug}`}
            variant="solid"
            size="sm"
            className="w-full sm:min-h-11 sm:px-5 sm:text-sm"
          >
            {product.isAvailable ? 'مشاهده و خرید' : 'مشاهده محصول'}
          </ButtonLink>
        </div>
      </div>
    </li>
  );
}
