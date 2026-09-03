import Link from 'next/link';

import { CatalogMedia } from '@/components/catalog/catalog-media';
import type { PublicCatalogProductSummary } from '@/lib/catalog/public-catalog';
import { formatTomanPrice } from '@/lib/catalog/presentation';

type CatalogProductCardProps = Readonly<{
  product: PublicCatalogProductSummary;
}>;

export function CatalogProductCard({ product }: CatalogProductCardProps) {
  return (
    <li>
      <Link href={`/products/${product.slug}`} className="group block">
        <div className="aspect-[4/5] overflow-hidden bg-[var(--sf-color-surface)]">
          <CatalogMedia media={product.primaryMedia} alt={product.name} />
        </div>

        <div className="pt-4">
          {product.brand ? (
            <p className="text-xs text-[var(--sf-color-subtle)]">{product.brand.name}</p>
          ) : null}
          <h2 className="mt-1 text-base font-medium transition-opacity group-hover:opacity-55">
            {product.name}
          </h2>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm">
            <span>{formatTomanPrice(product.salePriceToman)}</span>
            <span className="text-xs text-[var(--sf-color-muted)]">
              {product.isAvailable ? 'موجود' : 'ناموجود'}
            </span>
          </div>
        </div>
      </Link>
    </li>
  );
}
