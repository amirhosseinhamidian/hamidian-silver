import Link from 'next/link';

import { CatalogMedia } from '@/components/catalog/catalog-media';
import { DiscountBadge } from '@/components/catalog/discount-badge';
import { ButtonLink } from '@/components/ui/button';
import type { PublicCatalogProductSummary } from '@/lib/catalog/public-catalog';
import { formatTomanPrice } from '@/lib/catalog/presentation';
import { getDiscountPercent } from '@/lib/catalog/pricing';

type CatalogProductCardProps = Readonly<{
  product: PublicCatalogProductSummary;
  fallbackSrc?: string | null;
  badge?: string | null;
}>;

export function CatalogProductCard({
  product,
  fallbackSrc = null,
  badge = null,
}: CatalogProductCardProps) {
  return (
    <li className="sf-catalog-card group flex min-w-0 flex-col p-2">
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
        />
        {badge ? (
          <span className="absolute start-3 top-3 bg-[var(--sf-color-ink)] px-2.5 py-1 text-xs text-white">
            {badge}
          </span>
        ) : null}
        {!product.isAvailable ? (
          <span
            className="
              absolute end-3 top-3 rounded-full bg-[var(--sf-color-canvas)]
              px-3 py-1 text-xs text-[var(--sf-color-ink)] shadow-sm
            "
          >
            ناموجود
          </span>
        ) : null}
      </Link>

      <div className="flex flex-1 flex-col pt-4 text-center">
        {product.brand ? (
          <p className="text-[0.7rem] text-[var(--sf-color-subtle)]">{product.brand.name}</p>
        ) : null}

        <Link href={`/products/${product.slug}`} className="mt-2 block">
          <h2 className="text-sm font-medium leading-6 sm:text-base">{product.name}</h2>
        </Link>

        {product.shortDescription ? (
          <p
            className="
              mx-auto mt-2 line-clamp-2 max-w-sm text-xs leading-6
              text-[var(--sf-color-muted)] sm:text-sm
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

          <p className="text-sm font-medium sm:text-base">
            {formatTomanPrice(product.salePriceToman)}
          </p>
        </div>

        <div className="sf-catalog-card__action mt-auto pt-4">
          <ButtonLink href={`/products/${product.slug}`} variant="solid" className="w-full">
            {product.isAvailable ? 'مشاهده و خرید' : 'مشاهده محصول'}
          </ButtonLink>
        </div>
      </div>
    </li>
  );
}
