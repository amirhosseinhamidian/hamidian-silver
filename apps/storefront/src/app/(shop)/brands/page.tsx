import Link from 'next/link';

import { CatalogMedia } from '@/components/catalog/catalog-media';
import { getPublicCatalogBrands } from '@/lib/catalog/public-catalog';

export default async function BrandsPage() {
  const brands = await getPublicCatalogBrands();

  return (
    <main id="main-content" className="sf-container py-[var(--sf-section-space)]">
      <header className="border-b border-[var(--sf-color-border)] pb-8">
        <p className="text-sm text-[var(--sf-color-muted)]">کاتالوگ فروشگاه</p>
        <h1 className="mt-3 text-4xl font-normal sm:text-5xl">برندها</h1>
        <p className="mt-4 max-w-2xl text-sm leading-8 text-[var(--sf-color-muted)]">
          مجموعه برندهای فعال گالری حمیدیان را مرور کنید.
        </p>
      </header>

      {brands.length > 0 ? (
        <ul className="grid grid-cols-2 gap-x-4 gap-y-10 py-10 md:grid-cols-3">
          {brands.map((brand) => (
            <li key={brand.id}>
              <Link href={`/brands/${brand.slug}`} className="group block">
                <div className="aspect-[4/3] overflow-hidden bg-[var(--sf-color-surface)]">
                  <CatalogMedia media={brand.image} alt={brand.name} />
                </div>
                <h2 className="mt-4 text-lg font-medium transition-opacity group-hover:opacity-55">
                  {brand.name}
                </h2>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <section className="py-20 text-center">
          <h2 className="text-2xl font-medium">برندی برای نمایش وجود ندارد</h2>
          <Link
            href="/products"
            className="
              mt-6 inline-block border-b border-[var(--sf-color-ink)]
              pb-1 text-sm
            "
          >
            مشاهده محصولات
          </Link>
        </section>
      )}
    </main>
  );
}
