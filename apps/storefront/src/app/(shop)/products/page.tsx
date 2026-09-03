import Link from 'next/link';

import { CatalogMedia } from '@/components/catalog/catalog-media';
import {
  buildCatalogHref,
  getPublicCatalogIndex,
  parseCatalogSearchParams,
  type CatalogSearchParams,
  type PublicCatalogProductSummary,
} from '@/lib/catalog/public-catalog';
import { formatTomanPrice } from '@/lib/catalog/presentation';

type ProductsPageProps = Readonly<{
  searchParams: Promise<CatalogSearchParams>;
}>;

function ProductCard({ product }: Readonly<{ product: PublicCatalogProductSummary }>) {
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

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const filters = parseCatalogSearchParams(await searchParams);
  const { products, categories, brands } = await getPublicCatalogIndex(filters);
  const hasActiveFilters = Boolean(
    filters.q || filters.category || filters.brand || filters.sort !== 'newest',
  );

  return (
    <main id="main-content" className="sf-container py-[var(--sf-section-space)]">
      <header className="flex flex-col gap-5 border-b border-[var(--sf-color-border)] pb-8">
        <p className="text-sm text-[var(--sf-color-muted)]">کاتالوگ فروشگاه</p>
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <h1 className="text-4xl font-normal sm:text-5xl">محصولات نقره حمیدیان</h1>
            <p className="mt-3 text-sm text-[var(--sf-color-muted)]">
              {new Intl.NumberFormat('fa-IR').format(products.total)} محصول
            </p>
          </div>

          {hasActiveFilters ? (
            <Link
              href="/products"
              className="text-sm underline decoration-[var(--sf-color-border-strong)] underline-offset-4"
            >
              پاک کردن فیلترها
            </Link>
          ) : null}
        </div>
      </header>

      <form
        action="/products"
        method="get"
        className="
          grid gap-4 border-b border-[var(--sf-color-border)] py-6
          sm:grid-cols-2 lg:grid-cols-[minmax(14rem,1fr)_repeat(3,minmax(10rem,0.55fr))_auto]
        "
      >
        <label className="flex flex-col gap-2 text-xs text-[var(--sf-color-muted)]">
          جستجو
          <input
            type="search"
            name="q"
            defaultValue={filters.q ?? ''}
            maxLength={100}
            placeholder="نام محصول..."
            className="
              h-11 border border-[var(--sf-color-border)] bg-transparent px-3
              text-sm text-[var(--sf-color-ink)] outline-none
              focus:border-[var(--sf-color-border-strong)]
            "
          />
        </label>

        <label className="flex flex-col gap-2 text-xs text-[var(--sf-color-muted)]">
          دسته‌بندی
          <select
            name="category"
            defaultValue={filters.category ?? ''}
            className="
              h-11 border border-[var(--sf-color-border)] bg-transparent px-3
              text-sm text-[var(--sf-color-ink)] outline-none
              focus:border-[var(--sf-color-border-strong)]
            "
          >
            <option value="">همه دسته‌ها</option>
            {categories.map((category) => (
              <option key={category.id} value={category.slug}>
                {category.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-2 text-xs text-[var(--sf-color-muted)]">
          برند
          <select
            name="brand"
            defaultValue={filters.brand ?? ''}
            className="
              h-11 border border-[var(--sf-color-border)] bg-transparent px-3
              text-sm text-[var(--sf-color-ink)] outline-none
              focus:border-[var(--sf-color-border-strong)]
            "
          >
            <option value="">همه برندها</option>
            {brands.map((brand) => (
              <option key={brand.id} value={brand.slug}>
                {brand.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-2 text-xs text-[var(--sf-color-muted)]">
          مرتب‌سازی
          <select
            name="sort"
            defaultValue={filters.sort}
            className="
              h-11 border border-[var(--sf-color-border)] bg-transparent px-3
              text-sm text-[var(--sf-color-ink)] outline-none
              focus:border-[var(--sf-color-border-strong)]
            "
          >
            <option value="newest">جدیدترین‌ها</option>
            <option value="price-asc">کمترین قیمت</option>
            <option value="price-desc">بیشترین قیمت</option>
            <option value="name-asc">نام محصول</option>
          </select>
        </label>

        <button
          type="submit"
          className="
            h-11 self-end bg-[var(--sf-color-ink)] px-6 text-sm
            text-[var(--sf-color-inverse)] transition-opacity hover:opacity-80
          "
        >
          اعمال
        </button>
      </form>

      {products.items.length > 0 ? (
        <>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-10 py-10 md:grid-cols-3 lg:grid-cols-4">
            {products.items.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </ul>

          {products.totalPages > 1 ? (
            <nav
              aria-label="صفحه‌بندی محصولات"
              className="
                flex items-center justify-between gap-4
                border-t border-[var(--sf-color-border)] pt-6 text-sm
              "
            >
              {products.page > 1 ? (
                <Link href={buildCatalogHref(filters, { page: products.page - 1 })}>صفحه قبل</Link>
              ) : (
                <span />
              )}

              <span className="text-[var(--sf-color-muted)]">
                صفحه {new Intl.NumberFormat('fa-IR').format(products.page)} از{' '}
                {new Intl.NumberFormat('fa-IR').format(products.totalPages)}
              </span>

              {products.page < products.totalPages ? (
                <Link href={buildCatalogHref(filters, { page: products.page + 1 })}>صفحه بعد</Link>
              ) : (
                <span />
              )}
            </nav>
          ) : null}
        </>
      ) : (
        <section className="py-20 text-center" aria-labelledby="empty-catalog-title">
          <h2 id="empty-catalog-title" className="text-2xl font-medium">
            محصولی پیدا نشد
          </h2>
          <p className="mt-3 text-sm text-[var(--sf-color-muted)]">
            عبارت جستجو یا فیلترها را تغییر دهید.
          </p>
          <Link
            href="/products"
            className="
              mt-6 inline-block border-b border-[var(--sf-color-ink)]
              pb-1 text-sm
            "
          >
            مشاهده همه محصولات
          </Link>
        </section>
      )}
    </main>
  );
}
