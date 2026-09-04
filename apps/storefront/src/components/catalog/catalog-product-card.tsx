import Link from 'next/link';

import { CatalogMedia } from '@/components/catalog/catalog-media';
import { ButtonLink } from '@/components/ui/button';
import { getCatalogDevProductImageSrc } from '@/lib/catalog/dev-media.server';
import type { PublicCatalogProductSummary } from '@/lib/catalog/public-catalog';
import { formatTomanPrice } from '@/lib/catalog/presentation';

type CatalogProductCardProps = Readonly<{
  product: PublicCatalogProductSummary;
}>;

export function CatalogProductCard({ product }: CatalogProductCardProps) {
  return (
    <li className="sf-catalog-card group flex min-w-0 flex-col p-2">
      <Link
        href={`/products/${product.slug}`}
        className="
          sf-catalog-card__media block aspect-square overflow-hidden
          rounded-[var(--sf-radius-md)] bg-[var(--sf-color-surface)]
        "
      >
        <CatalogMedia
          media={product.primaryMedia}
          fallbackSrc={getCatalogDevProductImageSrc(product.slug)}
          alt={product.name}
        />
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

        <p className="mt-3 text-sm font-medium sm:text-base">
          {formatTomanPrice(product.salePriceToman)}
        </p>

        <div className="sf-catalog-card__action mt-auto pt-4">
          <ButtonLink href={`/products/${product.slug}`} variant="solid" className="w-full">
            مشاهده و خرید
          </ButtonLink>
        </div>
      </div>
    </li>
  );
}
