'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { FiX } from 'react-icons/fi';

import { SearchResultsAnalytics } from '@/components/analytics/conversion-trackers';
import { CatalogFilterForm } from '@/components/catalog/catalog-filter-form';
import { CatalogFilterSheet } from '@/components/catalog/catalog-filter-sheet';
import { CatalogProductGrid } from '@/components/catalog/catalog-product-grid';
import { Button, ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Select } from '@/components/ui/select';
import {
  buildFacetedCatalogHref,
  catalogFacetQuery,
  catalogFacetRanges,
  catalogFacetSearchParams,
  catalogSearchParamsFromEntries,
  parseCatalogFacetFilters,
  type CatalogFacetFilters,
  type CatalogFacetScope,
  type CatalogListing,
  type CatalogSort,
  type PublicCatalogFacets,
} from '@/lib/catalog/catalog-filter-state';

const number = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 3 });
const defaultScope: CatalogFacetScope = {};
const sortOptions = [
  { value: 'newest', label: 'جدیدترین‌ها' },
  { value: 'price-asc', label: 'کمترین قیمت' },
  { value: 'price-desc', label: 'بیشترین قیمت' },
  { value: 'name-asc', label: 'نام محصول' },
  { value: 'availability', label: 'بیشترین موجودی' },
  { value: 'best-selling', label: 'پرفروش‌ها' },
  { value: 'featured', label: 'اولویت فروشگاه' },
] as const;

type Chip = { label: string; name: string; value?: string; second?: string };

function filterChips(filters: CatalogFacetFilters, facets: PublicCatalogFacets): Chip[] {
  const query = catalogFacetQuery(filters);
  const options = (
    name: string,
    values: string[] | undefined,
    labels: PublicCatalogFacets['brands'],
  ) =>
    (values ?? []).map((value) => ({
      name,
      value,
      label: labels.find((item) => item.value === value)?.label ?? value,
    }));
  const range = (
    label: string,
    name: string,
    second: string,
    min?: number,
    max?: number,
  ): Chip[] => {
    const bounds = [
      min === undefined ? null : `از ${number.format(min)}`,
      max === undefined ? null : `تا ${number.format(max)}`,
    ].filter(Boolean);
    return bounds.length ? [{ label: `${label} ${bounds.join(' ')}`, name, second }] : [];
  };
  return [
    ...(filters.q ? [{ name: 'q', label: `جستجو: ${filters.q}` }] : []),
    ...(filters.country ? [{ name: 'country', label: `کشور: ${filters.country}` }] : []),
    ...options('category', query.categories, facets.categories),
    ...options('brand', query.brands, facets.brands),
    ...options('size', query.sizeIds, facets.sizes),
    ...options('availability', query.availability ? [query.availability] : [], [
      { value: 'in-stock', label: 'موجود', count: 0 },
      { value: 'out-of-stock', label: 'ناموجود', count: 0 },
    ]),
    ...catalogFacetRanges.flatMap(({ label, min, max }) =>
      range(label, min, max, query[min], query[max]),
    ),
    ...(query.attributes ?? []).flatMap(({ code, values, min, max }) => {
      const facet = facets.attributes.find((item) => item.code === code);
      return [
        ...options(`attr:${code}`, values, facet?.options ?? []),
        ...range(facet?.label ?? code, `min:${code}`, `max:${code}`, min, max),
      ];
    }),
  ];
}

type Props = Readonly<{
  path: string;
  filters: CatalogFacetFilters;
  listing: CatalogListing;
  scope?: CatalogFacetScope;
  fallbackSources?: Readonly<Record<string, string>>;
  prioritizeFirstImage?: boolean;
}>;

export function CatalogFacetedListing({
  path,
  filters,
  listing,
  scope = defaultScope,
  fallbackSources,
  prioritizeFirstImage = false,
}: Props) {
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const resultRef = useRef<HTMLParagraphElement>(null);
  const focusAfterNavigation = useRef(false);
  const href = buildFacetedCatalogHref(path, filters);
  const chips = filterChips(filters, listing.facets);
  const pageOutOfRange = listing.total > 0 && listing.page > listing.totalPages;

  useEffect(() => {
    if (focusAfterNavigation.current) {
      focusAfterNavigation.current = false;
      resultRef.current?.focus({ preventScroll: true });
    }
  }, [href]);

  function navigate(next: CatalogFacetFilters) {
    const destination = buildFacetedCatalogHref(path, { ...next, page: 1 });
    setSheetOpen(false);
    if (destination === href && !pending) return;
    focusAfterNavigation.current = true;
    startTransition(() => router.push(destination, { scroll: false }));
  }

  function clearFilters() {
    navigate({ page: 1, pageSize: filters.pageSize, sort: filters.sort });
  }

  function removeChip({ name, value, second }: Chip) {
    const params = catalogFacetSearchParams(filters);
    const remaining =
      value === undefined ? [] : params.getAll(name).filter((item) => item !== value);
    params.delete(name);
    for (const item of remaining) params.append(name, item);
    if (second) params.delete(second);
    navigate(parseCatalogFacetFilters(catalogSearchParamsFromEntries(params)));
  }

  return (
    <div className="pb-8">
      <SearchResultsAnalytics searchTerm={filters.q} resultCount={listing.total} />
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--sf-color-border)] py-5">
        <p
          ref={resultRef}
          tabIndex={-1}
          role="status"
          className="text-sm font-medium"
          data-testid="catalog-result-count"
        >
          {pending
            ? 'در حال به‌روزرسانی محصولات…'
            : listing.invalidFilters
              ? 'فیلترها نیاز به اصلاح دارند'
              : `${number.format(listing.total)} محصول`}
          {!pending && listing.total > 0 && listing.ranking?.requestedSort === 'best-selling' ? (
            <span className="mt-1 block text-xs text-[var(--sf-color-muted)]">
              {listing.ranking.appliedSort === 'newest'
                ? 'فروش تأییدشده کافی نیست. محصولات به ترتیب جدیدترین نمایش داده می‌شوند.'
                : 'محصولات با فروش تأییدشدهٔ کافی در ۳۰ روز گذشته در اولویت‌اند.'}
            </span>
          ) : null}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <div className="lg:hidden">
            <CatalogFilterSheet
              activeCount={chips.length}
              open={sheetOpen}
              onOpenChange={setSheetOpen}
            >
              <CatalogFilterForm
                key={href}
                path={path}
                filters={filters}
                facets={listing.facets}
                scope={scope}
                idPrefix="mobile-catalog-filter"
                className="h-full pt-2"
                onApply={navigate}
              />
            </CatalogFilterSheet>
          </div>
          <div className="w-[10.5rem] max-w-full sm:w-48">
            <Select
              aria-label="مرتب‌سازی محصولات"
              value={filters.sort}
              options={sortOptions}
              onValueChange={(sort) => navigate({ ...filters, sort: sort as CatalogSort })}
            />
          </div>
        </div>
      </div>

      {chips.length ? (
        <section
          aria-label="فیلترهای فعال"
          className="flex flex-wrap items-center gap-2 border-b border-[var(--sf-color-border)] py-4"
        >
          {chips.map((chip) => (
            <button
              key={`${chip.name}:${chip.value ?? ''}`}
              type="button"
              aria-label={`حذف فیلتر ${chip.label}`}
              onClick={() => removeChip(chip)}
              className="inline-flex min-h-9 max-w-full items-center gap-2 rounded-full border border-[var(--sf-color-border)] bg-[var(--sf-color-surface)] px-3 text-xs"
            >
              <span className="break-words">{chip.label}</span>
              <FiX aria-hidden="true" className="shrink-0" />
            </button>
          ))}
          <Button type="button" variant="text" size="sm" onClick={clearFilters}>
            پاک کردن همه فیلترها
          </Button>
        </section>
      ) : null}

      <div className="grid gap-8 pt-8 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-10">
        <aside aria-label="فیلتر محصولات" className="hidden lg:block">
          <div className="sticky top-6 flex max-h-[calc(100dvh-3rem)] flex-col">
            <h2 className="mb-5 text-base font-medium">فیلترها</h2>
            <CatalogFilterForm
              key={href}
              path={path}
              filters={filters}
              facets={listing.facets}
              scope={scope}
              idPrefix="desktop-catalog-filter"
              onApply={navigate}
            />
          </div>
        </aside>
        <section className="min-w-0" aria-busy={pending} aria-label="نتایج محصولات">
          {listing.items.length ? (
            <CatalogProductGrid
              key={href}
              filters={filters}
              facetScope={scope}
              paused={pending}
              initialProducts={listing}
              initialFallbackSources={fallbackSources}
              imageSizes="(min-width: 1536px) 20vw, (min-width: 1280px) 27vw, (min-width: 1024px) 40vw, 50vw"
              className="xl:grid-cols-3 2xl:grid-cols-4"
              paginationPath={path}
              prioritizeFirstImage={prioritizeFirstImage}
            />
          ) : (
            <EmptyState
              title={
                listing.invalidFilters
                  ? 'بعضی از فیلترها معتبر نیستند'
                  : pageOutOfRange
                    ? 'این صفحه از نتایج خالی است'
                    : 'محصولی پیدا نشد'
              }
              description={
                chips.length
                  ? 'عبارت جستجو یا فیلترها را تغییر دهید.'
                  : 'می‌توانید سایر محصولات گالری را مشاهده کنید.'
              }
              action={
                pageOutOfRange ? (
                  <Button type="button" variant="text" size="sm" onClick={() => navigate(filters)}>
                    صفحهٔ اول نتایج
                  </Button>
                ) : chips.length ? (
                  <Button type="button" variant="text" size="sm" onClick={clearFilters}>
                    بازگشت به فهرست محصولات
                  </Button>
                ) : path !== '/products' ? (
                  <ButtonLink href="/products" variant="text" size="sm">
                    مشاهده همه محصولات
                  </ButtonLink>
                ) : null
              }
            />
          )}
        </section>
      </div>
    </div>
  );
}
