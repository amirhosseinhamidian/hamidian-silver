import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ProductPurchasePanel } from '@/components/cart/product-purchase-panel';
import { CatalogMedia } from '@/components/catalog/catalog-media';
import { WishlistButton } from '@/components/wishlist/wishlist-button';
import { getCatalogDevProductImageSrc } from '@/lib/catalog/dev-media.server';
import {
  getPublicCatalogProduct,
  type PublicCatalogProductDetail,
} from '@/lib/catalog/public-catalog';
import { formatTomanPrice } from '@/lib/catalog/presentation';

type ProductDetailPageProps = Readonly<{
  params: Promise<{
    slug: string;
  }>;
}>;

function getSizeModeLabel(sizeMode: PublicCatalogProductDetail['sizeMode']): string {
  switch (sizeMode) {
    case 'SIZED':
      return 'دارای انتخاب سایز';
    case 'FREE_SIZE':
      return 'فری‌سایز';
    default:
      return 'بدون انتخاب سایز';
  }
}

export default async function ProductDetailPage({ params }: ProductDetailPageProps) {
  const { slug } = await params;
  const product = await getPublicCatalogProduct(slug);

  if (!product) {
    notFound();
  }

  const devImageSrc = getCatalogDevProductImageSrc(product.slug);
  const publicImages = product.media.filter(
    (media) => media.url && media.mimeType.startsWith('image/'),
  );
  const variantWeights = product.variants
    .map((variant) => variant.weightGrams)
    .filter((weight): weight is number => weight !== null);
  const uniqueWeights = [...new Set(variantWeights)];
  const weightLabel =
    uniqueWeights.length === 1
      ? `${new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 3 }).format(uniqueWeights[0])} گرم`
      : uniqueWeights.length > 1
        ? 'وابسته به سایز یا مدل انتخابی'
        : null;
  const features = [
    product.brand ? ['برند', product.brand.name] : null,
    product.country ? ['کشور سازنده', product.country.name] : null,
    ['سایزبندی', getSizeModeLabel(product.sizeMode)],
    weightLabel ? ['وزن تقریبی', weightLabel] : null,
  ].filter((feature): feature is [string, string] => feature !== null);

  return (
    <main
      id="main-content"
      className="sf-container pb-36 pt-8 sm:pt-10 lg:pb-[var(--sf-section-space)]"
    >
      <nav aria-label="مسیر صفحه" className="mb-5 text-xs text-[var(--sf-color-muted)] sm:mb-7">
        <Link href="/products">محصولات</Link>
        <span aria-hidden="true" className="mx-2">
          /
        </span>
        <span>{product.name}</span>
      </nav>

      <div className="grid gap-9 lg:grid-cols-[minmax(0,1.1fr)_minmax(22rem,0.9fr)] lg:gap-14">
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
            <div className="aspect-[4/5] overflow-hidden bg-[var(--sf-color-surface)]">
              <CatalogMedia
                media={product.primaryMedia}
                fallbackSrc={devImageSrc}
                alt={product.name}
                eager
              />
            </div>
          )}
        </section>

        <section aria-labelledby="product-title" className="lg:pt-2">
          {product.brand ? (
            <Link
              href={`/brands/${product.brand.slug}`}
              className="inline-flex items-center gap-3 text-[var(--sf-color-ink)]"
            >
              {product.brand.image?.url ? (
                <span className="size-10 overflow-hidden rounded-full bg-[var(--sf-color-surface)]">
                  <CatalogMedia media={product.brand.image} alt={`لوگوی ${product.brand.name}`} />
                </span>
              ) : null}
              <span className="flex flex-col gap-0.5">
                <span className="text-[0.68rem] text-[var(--sf-color-subtle)]">برند محصول</span>
                <span className="text-sm font-medium">{product.brand.name}</span>
              </span>
            </Link>
          ) : null}

          <h1 id="product-title" className="mt-4 text-4xl font-normal sm:text-5xl">
            {product.name}
          </h1>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
            <p className="text-2xl font-medium sm:text-3xl">
              {formatTomanPrice(product.salePriceToman)}
            </p>
            <WishlistButton
              item={{
                productId: product.id,
                slug: product.slug,
                name: product.name,
                brandName: product.brand?.name ?? null,
                media: product.primaryMedia,
                salePriceToman: product.salePriceToman,
              }}
            />
          </div>

          {product.shortDescription ? (
            <p className="mt-7 text-base leading-8 text-[var(--sf-color-muted)]">
              {product.shortDescription}
            </p>
          ) : null}

          {product.categories.length > 0 ? (
            <div className="mt-7 flex flex-wrap gap-2">
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

          {features.length > 0 ? (
            <section
              aria-labelledby="features-title"
              className="mt-10 border-t border-[var(--sf-color-border)] pt-8"
            >
              <h2 id="features-title" className="text-sm font-medium">
                ویژگی‌های محصول
              </h2>
              <dl className="mt-5 divide-y divide-[var(--sf-color-border)] text-sm">
                {features.map(([label, value]) => (
                  <div key={label} className="grid grid-cols-[8rem_1fr] gap-4 py-3">
                    <dt className="text-[var(--sf-color-muted)]">{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}

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
