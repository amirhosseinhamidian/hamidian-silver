import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form-control';
import type {
  CatalogFilters,
  PublicCatalogBrand,
  PublicCatalogCategory,
} from '@/lib/catalog/public-catalog';

type CatalogFilterFormProps = Readonly<{
  filters: CatalogFilters;
  categories: readonly PublicCatalogCategory[];
  brands: readonly PublicCatalogBrand[];
  idPrefix: string;
  className?: string;
}>;

export function CatalogFilterForm({
  filters,
  categories,
  brands,
  idPrefix,
  className,
}: CatalogFilterFormProps) {
  const categoryHeadingId = `${idPrefix}-category-heading`;
  const brandHeadingId = `${idPrefix}-brand-heading`;

  return (
    <form action="/products" method="get" className={className}>
      {filters.sort !== 'newest' ? <input type="hidden" name="sort" value={filters.sort} /> : null}

      <div className="border-b border-[var(--sf-color-border)] pb-7">
        <label
          htmlFor={`${idPrefix}-search`}
          className="mb-2 block text-xs font-medium text-[var(--sf-color-muted)]"
        >
          جستجو
        </label>
        <Input
          id={`${idPrefix}-search`}
          type="search"
          name="q"
          defaultValue={filters.q ?? ''}
          maxLength={100}
          placeholder="نام محصول..."
        />
      </div>

      <section className="border-b border-[var(--sf-color-border)] py-7">
        <h3 id={categoryHeadingId} className="text-sm font-medium">
          دسته‌بندی
        </h3>
        <div role="radiogroup" aria-labelledby={categoryHeadingId} className="mt-5 grid gap-3.5">
          <label className="flex cursor-pointer items-center gap-3 text-sm">
            <input
              type="radio"
              name="category"
              value=""
              defaultChecked={!filters.category}
              className="size-4 accent-[var(--sf-color-ink)]"
            />
            <span>همه دسته‌ها</span>
          </label>
          {categories.map((category) => (
            <label key={category.id} className="flex cursor-pointer items-center gap-3 text-sm">
              <input
                type="radio"
                name="category"
                value={category.slug}
                defaultChecked={filters.category === category.slug}
                className="size-4 accent-[var(--sf-color-ink)]"
              />
              <span>{category.name}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="border-b border-[var(--sf-color-border)] py-7">
        <h3 id={brandHeadingId} className="text-sm font-medium">
          برند
        </h3>
        <div role="radiogroup" aria-labelledby={brandHeadingId} className="mt-5 grid gap-3.5">
          <label className="flex cursor-pointer items-center gap-3 text-sm">
            <input
              type="radio"
              name="brand"
              value=""
              defaultChecked={!filters.brand}
              className="size-4 accent-[var(--sf-color-ink)]"
            />
            <span>همه برندها</span>
          </label>
          {brands.map((brand) => (
            <label key={brand.id} className="flex cursor-pointer items-center gap-3 text-sm">
              <input
                type="radio"
                name="brand"
                value={brand.slug}
                defaultChecked={filters.brand === brand.slug}
                className="size-4 accent-[var(--sf-color-ink)]"
              />
              <span>{brand.name}</span>
            </label>
          ))}
        </div>
      </section>

      <div className="sticky bottom-0 bg-[var(--sf-color-canvas)] pt-7">
        <Button type="submit" className="w-full">
          اعمال فیلترها
        </Button>
        <Link
          href="/products"
          className="
            mt-3 block rounded-[var(--sf-radius-md)] px-3 py-2 text-center
            text-xs text-[var(--sf-color-muted)] transition-colors
            hover:bg-[var(--sf-color-surface)]
          "
        >
          پاک کردن فیلترها
        </Link>
      </div>
    </form>
  );
}
