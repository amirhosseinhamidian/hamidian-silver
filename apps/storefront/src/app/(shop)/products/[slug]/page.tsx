import Link from 'next/link';
import { notFound } from 'next/navigation';

import { CatalogMedia } from '@/components/catalog/catalog-media';
import { ProductPurchasePanel } from '@/components/cart/product-purchase-panel';
import { getPublicCatalogProduct } from '@/lib/catalog/public-catalog';
import { formatTomanPrice } from '@/lib/catalog/presentation';

type ProductDetailPageProps = Readonly<{
  params: Promise<{
    slug: string;
  }>;
}>;

export default async function ProductDetailPage({ params }: ProductDetailPageProps) {
  const { slug } = await params;
  const product = await getPublicCatalogProduct(slug);

  if (!product) {
    notFound();
  }

  const publicImages = product.media.filter(
    (media) => media.url && media.mimeType.startsWith('image/'),
  );

  return (
    <main id="main-content" className="sf-container py-[var(--sf-section-space)]">
      <nav aria-label="مسیر صفحه" className="mb-8 text-xs text-[var(--sf-color-muted)]">
        <Link href="/products">محصولات</Link>
        <span aria-hidden="true" className="mx-2">
          /
        </span>
        <span>{product.name}</span>
      </nav>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(22rem,0.9fr)] lg:gap-16">
        <section aria-label="رسانه محصول">
          {publicImages.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {publicImages.map((media, index) => (
                <div
                  key={media.url ?? index}
                  className={
                    index === 0
                      ? 'aspect-[4/5] overflow-hidden bg-[var(--sf-color-surface)] sm:col-span-2'
                      : 'aspect-square overflow-hidden bg-[var(--sf-color-surface)]'
                  }
                >
                  <CatalogMedia media={media} alt={product.name} eager={index === 0} />
                </div>
              ))}
            </div>
          ) : (
            <div
              className="
                min-h-[28rem] bg-[var(--sf-color-surface)]
              "
            >
              <CatalogMedia media={product.primaryMedia} alt={product.name} eager />
            </div>
          )}
        </section>

        <section aria-labelledby="product-title" className="lg:pt-4">
          {product.brand ? (
            <Link
              href={`/brands/${product.brand.slug}`}
              className="text-xs text-[var(--sf-color-muted)]"
            >
              {product.brand.name}
            </Link>
          ) : null}

          <h1 id="product-title" className="mt-3 text-4xl font-normal sm:text-5xl">
            {product.name}
          </h1>

          <p className="mt-6 text-xl">{formatTomanPrice(product.salePriceToman)}</p>

          <div className="mt-3 text-sm text-[var(--sf-color-muted)]">
            {product.isAvailable
              ? `${new Intl.NumberFormat('fa-IR').format(product.availableQuantity)} عدد موجود`
              : 'در حال حاضر ناموجود'}
          </div>

          {product.shortDescription ? (
            <p className="mt-8 text-base leading-8 text-[var(--sf-color-muted)]">
              {product.shortDescription}
            </p>
          ) : null}

          {product.categories.length > 0 ? (
            <div className="mt-8 flex flex-wrap gap-2">
              {product.categories.map((category) => (
                <Link
                  key={category.id}
                  href={`/categories/${category.slug}`}
                  className="
                    border border-[var(--sf-color-border)] px-3 py-2
                    text-xs text-[var(--sf-color-muted)]
                  "
                >
                  {category.name}
                </Link>
              ))}
            </div>
          ) : null}

          <ProductPurchasePanel product={product} />

          {product.description ? (
            <section
              aria-labelledby="description-title"
              className="mt-10 border-t border-[var(--sf-color-border)] pt-8"
            >
              <h2 id="description-title" className="text-sm font-medium">
                توضیحات محصول
              </h2>
              <p className="mt-4 whitespace-pre-line text-sm leading-8 text-[var(--sf-color-muted)]">
                {product.description}
              </p>
            </section>
          ) : null}
        </section>
      </div>
    </main>
  );
}
