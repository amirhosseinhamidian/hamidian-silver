import Link from 'next/link';

import { CatalogMedia } from '@/components/catalog/catalog-media';
import { CatalogProductGrid } from '@/components/catalog/catalog-product-grid';
import { StorefrontBreadcrumbs } from '@/components/seo/storefront-breadcrumbs';
import { Button, ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { FormField } from '@/components/ui/form-field';
import { Select } from '@/components/ui/select';
import { getCatalogDevProductImageSources } from '@/lib/catalog/dev-media.server';
import {
  buildCatalogCollectionHref,
  type CatalogFilters,
  type PublicCatalogMedia,
  type PublicCatalogProductList,
} from '@/lib/catalog/public-catalog';

type CatalogCollectionPageProps = Readonly<{
  path: string;
  eyebrow: string;
  title: string;
  description: string | null;
  image: PublicCatalogMedia | null;
  filters: CatalogFilters;
  products: PublicCatalogProductList;
}>;

const persianNumber = new Intl.NumberFormat('fa-IR');

const sortOptions = [
  { value: 'newest', label: 'جدیدترین‌ها' },
  { value: 'price-asc', label: 'کمترین قیمت' },
  { value: 'price-desc', label: 'بیشترین قیمت' },
  { value: 'name-asc', label: 'نام محصول' },
] as const;

function CollectionHero({
  path,
  eyebrow,
  title,
  description,
  image,
  total,
}: Pick<CatalogCollectionPageProps, 'path' | 'eyebrow' | 'title' | 'description' | 'image'> &
  Readonly<{ total: number }>) {
  const parent = path.startsWith('/brands/')
    ? { label: 'برندها', href: '/brands' }
    : { label: 'محصولات', href: '/products' };
  const copy = (
    <div className="max-w-2xl">
      <StorefrontBreadcrumbs
        items={[{ label: 'خانه', href: '/' }, parent, { label: title, href: path }]}
        className="opacity-80"
      />
      <p className="mt-6 text-sm opacity-75">{eyebrow}</p>
      <h1 className="mt-3 text-4xl font-normal sm:text-5xl lg:text-6xl">{title}</h1>
      {description ? <p className="mt-5 text-sm leading-8 opacity-80">{description}</p> : null}
      <p className="mt-5 text-sm opacity-65">{persianNumber.format(total)} محصول</p>
    </div>
  );

  if (!image) {
    return (
      <header className="sf-container pt-[var(--sf-section-space)]">
        <div className="text-[var(--sf-color-ink)]">{copy}</div>
      </header>
    );
  }

  return (
    <header className="relative isolate min-h-[18rem] overflow-hidden bg-[var(--sf-color-surface)] sm:min-h-[24rem] lg:min-h-[calc(100svh-9.25rem)]">
      <div className="absolute inset-0 -z-20">
        <CatalogMedia
          media={image}
          alt={title}
          preload
          sizes="100vw"
          imageClassName="object-cover"
        />
      </div>
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/65 via-black/15 to-black/5" />
      <div className="sf-container flex min-h-[inherit] items-end py-10 text-white sm:py-14">
        {copy}
      </div>
    </header>
  );
}

export function CatalogCollectionPage({
  path,
  eyebrow,
  title,
  description,
  image,
  filters,
  products,
}: CatalogCollectionPageProps) {
  return (
    <main id="main-content">
      <CollectionHero
        path={path}
        eyebrow={eyebrow}
        title={title}
        description={description}
        image={image}
        total={products.total}
      />

      <div className="sf-container">
        <form
          action={path}
          method="get"
          className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--sf-color-border)] py-6"
        >
          <FormField id={`collection-sort-${path}`} label="مرتب‌سازی" className="min-w-52">
            {(controlProps) => (
              <Select
                {...controlProps}
                name="sort"
                defaultValue={filters.sort}
                options={sortOptions}
              />
            )}
          </FormField>

          <Button type="submit">اعمال</Button>
        </form>

        {products.items.length > 0 ? (
          <>
            <CatalogProductGrid
              key={`${path}:${filters.sort}:${filters.page}`}
              filters={filters}
              initialProducts={products}
              initialFallbackSources={getCatalogDevProductImageSources(products.items)}
              imageSizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw"
              className="py-10 md:grid-cols-3 lg:grid-cols-4"
            />
            {products.page < products.totalPages ? (
              <noscript>
                <div className="border-t border-[var(--sf-color-border)] pt-6 text-center text-sm">
                  <Link
                    href={buildCatalogCollectionHref(path, filters, {
                      page: products.page + 1,
                    })}
                  >
                    مشاهده محصولات بیشتر
                  </Link>
                </div>
              </noscript>
            ) : null}
          </>
        ) : (
          <EmptyState
            title="هنوز محصولی در این مجموعه نیست"
            description="می‌توانید سایر محصولات گالری را مشاهده کنید."
            action={
              <ButtonLink href="/products" variant="text" size="sm">
                مشاهده همه محصولات
              </ButtonLink>
            }
          />
        )}
      </div>
    </main>
  );
}
