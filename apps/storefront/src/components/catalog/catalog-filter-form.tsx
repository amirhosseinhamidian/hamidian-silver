'use client';

import Link from 'next/link';
import { useState } from 'react';
import { FiChevronDown } from 'react-icons/fi';

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

type FilterOption = Readonly<{ id: string; name: string; slug: string }>;
type ExpandedGroup = 'categories' | 'brands' | null;
const COLLAPSED_OPTION_COUNT = 4;

function collapsedOptions(options: readonly FilterOption[], selectedSlug: string | undefined) {
  const initial = options.slice(0, COLLAPSED_OPTION_COUNT);
  const selected = selectedSlug
    ? options.find((option) => option.slug === selectedSlug)
    : undefined;
  if (!selected || initial.some((option) => option.id === selected.id)) return initial;
  return [...initial.slice(0, COLLAPSED_OPTION_COUNT - 1), selected];
}

function ExpandableFilterOptions({
  group,
  options,
  selectedSlug,
  inputName,
  idPrefix,
  expandedGroup,
  onToggle,
}: Readonly<{
  group: Exclude<ExpandedGroup, null>;
  options: readonly FilterOption[];
  selectedSlug: string | undefined;
  inputName: 'category' | 'brand';
  idPrefix: string;
  expandedGroup: ExpandedGroup;
  onToggle: (group: Exclude<ExpandedGroup, null>) => void;
}>) {
  const isExpanded = expandedGroup === group;
  const initial = collapsedOptions(options, selectedSlug);
  const initialIds = new Set(initial.map((option) => option.id));
  const remaining = options.filter((option) => !initialIds.has(option.id));
  const contentId = `${idPrefix}-${inputName}-remaining-options`;
  const renderOption = (option: FilterOption) => (
    <label key={option.id} className="flex cursor-pointer items-center gap-3 text-sm">
      <input
        type="radio"
        name={inputName}
        value={option.slug}
        defaultChecked={selectedSlug === option.slug}
        className="size-4 accent-[var(--sf-color-ink)]"
      />
      <span>{option.name}</span>
    </label>
  );

  return (
    <>
      {initial.map(renderOption)}
      {remaining.length > 0 ? (
        <>
          <div
            id={contentId}
            aria-hidden={!isExpanded}
            inert={!isExpanded}
            className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none ${
              isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
            }`}
          >
            <div className="overflow-hidden">
              <div className="grid gap-3.5 pt-3.5">{remaining.map(renderOption)}</div>
            </div>
          </div>
          <button
            type="button"
            aria-expanded={isExpanded}
            aria-controls={contentId}
            onClick={() => onToggle(group)}
            className="flex min-h-9 items-center gap-2 text-xs font-medium text-[var(--sf-color-muted)] transition-colors hover:text-[var(--sf-color-ink)]"
          >
            <FiChevronDown
              aria-hidden="true"
              className={`transition-transform duration-300 motion-reduce:transition-none ${isExpanded ? 'rotate-180' : ''}`}
              size={16}
            />
            {isExpanded
              ? 'نمایش کمتر'
              : `نمایش ${remaining.length.toLocaleString('fa-IR')} مورد بیشتر`}
          </button>
        </>
      ) : null}
    </>
  );
}

export function CatalogFilterForm({
  filters,
  categories,
  brands,
  idPrefix,
  className,
}: CatalogFilterFormProps) {
  const [expandedGroup, setExpandedGroup] = useState<ExpandedGroup>(null);
  const categoryHeadingId = `${idPrefix}-category-heading`;
  const brandHeadingId = `${idPrefix}-brand-heading`;
  const handleToggle = (group: Exclude<ExpandedGroup, null>) => {
    setExpandedGroup((current) => (current === group ? null : group));
  };

  return (
    <form
      action="/products"
      method="get"
      className={`flex min-h-0 flex-col overflow-hidden ${className ?? ''}`}
    >
      {filters.sort !== 'newest' ? <input type="hidden" name="sort" value={filters.sort} /> : null}
      {filters.country ? <input type="hidden" name="country" value={filters.country} /> : null}

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pe-2">
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
            <ExpandableFilterOptions
              group="categories"
              options={categories}
              selectedSlug={filters.category}
              inputName="category"
              idPrefix={idPrefix}
              expandedGroup={expandedGroup}
              onToggle={handleToggle}
            />
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
            <ExpandableFilterOptions
              group="brands"
              options={brands}
              selectedSlug={filters.brand}
              inputName="brand"
              idPrefix={idPrefix}
              expandedGroup={expandedGroup}
              onToggle={handleToggle}
            />
          </div>
        </section>
      </div>

      <div className="shrink-0 border-t border-[var(--sf-color-border)] bg-[var(--sf-color-canvas)] pt-4">
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
