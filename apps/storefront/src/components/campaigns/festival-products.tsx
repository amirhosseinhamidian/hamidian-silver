'use client';

import type { components } from '@hamidian/contracts';
import Link from 'next/link';
import { useState } from 'react';
import { CatalogProductCard } from '@/components/catalog/catalog-product-card';
import { CatalogProductGrid } from '@/components/catalog/catalog-product-grid';
import {
  campaignFilterParams,
  campaignPageHref,
  campaignSorts,
  hasCampaignFilters,
  type CampaignFilters,
} from '@/lib/campaigns/campaign-filters';
import { parseCatalogFacetFilters } from '@/lib/catalog/catalog-filter-state';

type Products = components['schemas']['PublicCatalogProductListDto'];
type FilterOption = components['schemas']['PublicCatalogFacetOptionDto'];
const number = new Intl.NumberFormat('fa-IR');
const inputStyle =
  'min-h-10 min-w-0 rounded-md border border-current/30 bg-[var(--sf-color-surface)] px-2 py-1';

export function FestivalProducts({
  products,
  slug,
  filters,
  filterCategories = [],
  filterBrands = [],
  preview = false,
}: {
  products: Products;
  slug: string;
  filters: CampaignFilters;
  filterCategories?: FilterOption[];
  filterBrands?: FilterOption[];
  preview?: boolean;
}) {
  const [autoLoad, setAutoLoad] = useState(true);
  const pathname = `/campaigns/${slug}`;
  const categories = new Map(filterCategories.map(({ value, label }) => [value, label]));
  const brands = new Map(filterBrands.map(({ value, label }) => [value, label]));
  if (filters.scopeCategory && !categories.has(filters.scopeCategory))
    categories.set(filters.scopeCategory, filters.scopeCategory);
  if (filters.scopeBrand && !brands.has(filters.scopeBrand))
    brands.set(filters.scopeBrand, filters.scopeBrand);
  const totalPages = Math.min(products.totalPages, 1000);
  const query = campaignFilterParams(filters).toString();
  const filtered = hasCampaignFilters(filters);

  if (preview) {
    return products.items.length ? (
      <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {products.items.map((product) => (
          <CatalogProductCard key={product.id} product={product} variant="festival" />
        ))}
      </ul>
    ) : (
      <p>محصولی مطابق تنظیمات فعلی مجموعه وجود ندارد.</p>
    );
  }

  return (
    <>
      <form
        action={`${pathname}#campaign-products`}
        method="get"
        className="mb-7 grid grid-cols-2 gap-3 rounded-lg border border-current/20 p-4 text-sm md:grid-cols-3 lg:grid-cols-6"
      >
        <label className="grid gap-1">
          دسته
          <select name="category" defaultValue={filters.scopeCategory ?? ''} className={inputStyle}>
            <option value="">همهٔ دسته‌ها</option>
            {[...categories].map(([slug, name]) => (
              <option value={slug} key={slug}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1">
          برند
          <select name="brand" defaultValue={filters.scopeBrand ?? ''} className={inputStyle}>
            <option value="">همهٔ برندها</option>
            {[...brands].map(([slug, name]) => (
              <option value={slug} key={slug}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1">
          کمترین قیمت (تومان)
          <input
            type="number"
            min={1}
            max={2_147_483_647}
            step={1}
            name="minPriceToman"
            defaultValue={filters.minPriceToman}
            className={inputStyle}
          />
        </label>
        <label className="grid gap-1">
          بیشترین قیمت (تومان)
          <input
            type="number"
            min={1}
            max={2_147_483_647}
            step={1}
            name="maxPriceToman"
            defaultValue={filters.maxPriceToman}
            className={inputStyle}
          />
        </label>
        <label className="grid gap-1">
          ترتیب نمایش
          <select name="sort" defaultValue={filters.sort ?? ''} className={inputStyle}>
            <option value="">ترتیب مجموعه</option>
            {campaignSorts.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button
          className="self-end rounded-md border border-current px-3 py-2 font-semibold"
          type="submit"
        >
          اعمال فیلتر
        </button>
        {filtered && (
          <Link className="underline underline-offset-4" href={`${pathname}#campaign-products`}>
            پاک کردن فیلترها
          </Link>
        )}
      </form>

      {products.items.length > 0 ? (
        <>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 text-sm">
            <span>{number.format(products.total)} محصول</span>
            {products.page < totalPages && (
              <button
                type="button"
                className="underline underline-offset-4"
                onClick={() => setAutoLoad((current) => !current)}
              >
                {autoLoad ? 'توقف بارگذاری خودکار' : 'فعال کردن بارگذاری خودکار'}
              </button>
            )}
            <Link
              href="#campaign-list-end"
              className="underline underline-offset-4"
              onClick={() => setAutoLoad(false)}
            >
              رفتن به پایان فهرست
            </Link>
            <Link
              href="#storefront-footer"
              className="underline underline-offset-4"
              onClick={() => setAutoLoad(false)}
            >
              رفتن به پاورقی فروشگاه
            </Link>
          </div>
          <CatalogProductGrid
            cardVariant="festival"
            filters={parseCatalogFacetFilters({})}
            initialProducts={{ ...products, totalPages }}
            paginationPath={pathname}
            campaignRequest={{ pathname: `/api/campaigns/${slug}/products`, query }}
            autoLoad={autoLoad}
            className="md:grid-cols-3 lg:grid-cols-4"
          />
          <nav
            id="campaign-list-end"
            tabIndex={-1}
            aria-label="صفحات مجموعه"
            className="mt-8 flex scroll-mt-24 flex-wrap justify-center gap-4 text-sm"
          >
            {products.page > 1 && (
              <a
                href={campaignPageHref(pathname, filters, products.page - 1)}
                rel={filtered ? 'nofollow' : undefined}
                className="underline"
              >
                صفحهٔ قبل
              </a>
            )}
            <span>صفحهٔ {number.format(products.page)}</span>
            {products.page < totalPages && (
              <a
                href={campaignPageHref(pathname, filters, products.page + 1)}
                rel={filtered ? 'nofollow' : undefined}
                className="underline"
              >
                صفحهٔ بعد
              </a>
            )}
          </nav>
        </>
      ) : (
        <p className="rounded-lg border border-current/20 p-4">
          در این مجموعه محصولی با فیلترهای انتخاب‌شده پیدا نشد.
        </p>
      )}
    </>
  );
}
