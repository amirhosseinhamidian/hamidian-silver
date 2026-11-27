'use client';

import { useState, type FormEvent } from 'react';
import { FiChevronDown } from 'react-icons/fi';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form-control';
import {
  catalogFacetQuery,
  catalogFacetRanges,
  catalogSearchParamsFromEntries,
  readCatalogFacetFilters,
  type CatalogFacetFilters,
  type CatalogFacetScope,
  type PublicCatalogFacets,
} from '@/lib/catalog/catalog-filter-state';
import { cn } from '@/lib/ui/cn';

type Option = PublicCatalogFacets['brands'][number];
type Range = PublicCatalogFacets['priceToman'];

type CatalogFilterFormProps = Readonly<{
  path: string;
  filters: CatalogFacetFilters;
  facets: PublicCatalogFacets;
  scope?: CatalogFacetScope;
  idPrefix: string;
  className?: string;
  onApply: (filters: CatalogFacetFilters) => void;
}>;

const number = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 3 });
const visibleOptionCount = 4;
const section = 'border-b border-[var(--sf-color-border)] py-5';
const legend = 'text-sm font-medium';

function FilterChoices({
  name,
  title,
  options,
  selected,
  single,
  expanded,
  onToggle,
  idPrefix,
}: Readonly<{
  name: string;
  title: string;
  options: readonly Option[];
  selected: readonly string[];
  single?: boolean;
  expanded: boolean;
  onToggle: () => void;
  idPrefix: string;
}>) {
  const choices = [...options];
  for (const value of selected) {
    if (!choices.some((choice) => choice.value === value))
      choices.push({ value, label: value, count: 0 });
  }
  if (!choices.length) return null;

  const visible = choices.filter(
    ({ value }, index) => index < visibleOptionCount || selected.includes(value),
  );
  const remaining = choices.filter((choice) => !visible.includes(choice));
  const moreId = `${idPrefix}-${name}-more`;
  const render = ({ value, label, count }: Option) => (
    <label key={value} className="flex min-h-8 cursor-pointer items-center gap-2.5 text-sm">
      <input
        type={single ? 'radio' : 'checkbox'}
        name={name}
        value={value}
        defaultChecked={selected.includes(value)}
        className="size-4 shrink-0 accent-[var(--sf-color-ink)]"
      />
      <span className="min-w-0 flex-1 break-words">{label}</span>
      <span className="text-xs tabular-nums text-[var(--sf-color-muted)]" aria-hidden="true">
        {number.format(count)}
      </span>
      <span className="sr-only">، {number.format(count)} محصول</span>
    </label>
  );
  return (
    <fieldset className={section}>
      <legend className={legend}>{title}</legend>
      <div className="grid gap-1">
        {single ? (
          <label className="flex min-h-8 cursor-pointer items-center gap-2.5 text-sm">
            <input
              type="radio"
              name={name}
              value=""
              defaultChecked={!selected.length}
              className="size-4 accent-[var(--sf-color-ink)]"
            />
            همه
          </label>
        ) : null}
        {visible.map(render)}
        {remaining.length ? (
          <>
            <div id={moreId} hidden={!expanded} className={expanded ? 'grid gap-1' : 'hidden'}>
              {remaining.map(render)}
            </div>
            <button
              type="button"
              aria-expanded={expanded}
              aria-controls={moreId}
              onClick={onToggle}
              className="flex min-h-9 items-center gap-2 text-xs font-medium text-[var(--sf-color-muted)]"
            >
              <FiChevronDown
                aria-hidden="true"
                className={expanded ? 'rotate-180' : undefined}
                size={16}
              />
              {expanded ? 'نمایش کمتر' : `نمایش ${number.format(remaining.length)} مورد بیشتر`}
            </button>
          </>
        ) : null}
      </div>
    </fieldset>
  );
}

function FilterRange({
  label,
  minName,
  maxName,
  min,
  max,
  range,
  idPrefix,
}: Readonly<{
  label: string;
  minName: string;
  maxName: string;
  min?: number;
  max?: number;
  range: Range;
  idPrefix: string;
}>) {
  if (!range && min === undefined && max === undefined) return null;
  return (
    <fieldset className={section}>
      <legend className={legend}>{label}</legend>
      <div className="grid grid-cols-2 gap-2">
        {[
          { name: minName, title: 'حداقل', value: min, hint: range?.min },
          { name: maxName, title: 'حداکثر', value: max, hint: range?.max },
        ].map(({ name, title, value, hint }) => (
          <label
            key={name}
            htmlFor={`${idPrefix}-${name}`}
            className="grid min-w-0 gap-1 text-xs text-[var(--sf-color-muted)]"
          >
            {title}
            <Input
              id={`${idPrefix}-${name}`}
              name={name}
              aria-label={`${title} ${label}`}
              inputMode="decimal"
              dir="ltr"
              maxLength={20}
              defaultValue={value === undefined ? '' : number.format(value)}
              placeholder={hint === undefined ? undefined : number.format(hint)}
              className="px-2 text-right"
            />
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function CatalogFilterForm({
  path,
  filters,
  facets,
  scope,
  idPrefix,
  className,
  onApply,
}: CatalogFilterFormProps) {
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const query = catalogFacetQuery(filters);
  const categories = facets.categories.filter(
    ({ value }) => value !== scope?.category || query.categories?.includes(value),
  );
  const brands = scope?.brand ? [] : facets.brands;
  const choiceProps = (name: string) => ({
    name,
    idPrefix,
    expanded: name === expandedGroup,
    onToggle: () => setExpandedGroup((current) => (current === name ? null : name)),
  });
  const attributeCodes = new Set([
    ...facets.attributes.map(({ code }) => code),
    ...(filters.attributes ?? []).map(({ code }) => code),
  ]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const selectedAttributes = new Set(
      Array.from(data.entries()).flatMap(([key, value]) => {
        const code = /^(?:attr|min|max):(.+)$/.exec(key)?.[1];
        return code && typeof value === 'string' && value.trim() ? [code] : [];
      }),
    );
    if (
      selectedAttributes.size > 8 ||
      [...new Set(data.keys())].some((key) => data.getAll(key).length > 16)
    ) {
      setError('حداکثر ۸ ویژگی و ۱۶ گزینه برای هر گروه قابل انتخاب است.');
      return;
    }
    const params = catalogSearchParamsFromEntries(data);
    const result = readCatalogFacetFilters(params);
    if (result.invalidRange) {
      setError('بازه‌ها را با عدد معتبر وارد کنید. حداقل باید از حداکثر بیشتر نباشد.');
      return;
    }
    setError(null);
    onApply(result.filters);
  }

  return (
    <form
      action={path}
      method="get"
      onSubmit={submit}
      className={cn('flex min-h-0 flex-col overflow-hidden', className)}
    >
      {filters.sort !== 'newest' ? <input type="hidden" name="sort" value={filters.sort} /> : null}
      {filters.country ? <input type="hidden" name="country" value={filters.country} /> : null}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pe-2">
        <label
          htmlFor={`${idPrefix}-search`}
          className="grid gap-2 border-b border-[var(--sf-color-border)] pb-5 text-sm font-medium"
        >
          جستجو
          <Input
            id={`${idPrefix}-search`}
            name="q"
            type="search"
            defaultValue={filters.q ?? ''}
            maxLength={100}
            placeholder="نام محصول…"
          />
        </label>
        <FilterChoices
          {...choiceProps('category')}
          title="دسته‌بندی"
          options={categories}
          selected={query.categories ?? []}
        />
        <FilterChoices
          {...choiceProps('brand')}
          title="برند"
          options={brands}
          selected={query.brands ?? []}
        />
        <FilterChoices
          {...choiceProps('availability')}
          title="موجودی"
          options={facets.availability}
          selected={query.availability ? [query.availability] : []}
          single
        />
        <FilterChoices
          {...choiceProps('size')}
          title="سایز"
          options={facets.sizes}
          selected={query.sizeIds ?? []}
        />
        {catalogFacetRanges.map(({ facet, min, max, label }) => (
          <FilterRange
            key={facet}
            label={label}
            minName={min}
            maxName={max}
            min={query[min]}
            max={query[max]}
            range={facets[facet]}
            idPrefix={idPrefix}
          />
        ))}
        {[...attributeCodes].map((code) => {
          const facet = facets.attributes.find((item) => item.code === code);
          const chosen = filters.attributes?.find((item) => item.code === code);
          const label = facet?.label ?? code;
          return facet?.range || chosen?.min !== undefined || chosen?.max !== undefined ? (
            <FilterRange
              key={code}
              label={label}
              minName={`min:${code}`}
              maxName={`max:${code}`}
              min={chosen?.min}
              max={chosen?.max}
              range={facet?.range ?? null}
              idPrefix={idPrefix}
            />
          ) : (
            <FilterChoices
              key={code}
              {...choiceProps(`attr:${code}`)}
              title={label}
              options={facet?.options ?? []}
              selected={chosen?.values ?? []}
            />
          );
        })}
      </div>
      <div className="shrink-0 border-t border-[var(--sf-color-border)] bg-[var(--sf-color-canvas)] pt-4">
        {error ? (
          <p role="alert" className="mb-3 text-sm text-[var(--sf-color-ink)]">
            {error}
          </p>
        ) : null}
        <Button type="submit" className="w-full">
          اعمال فیلترها
        </Button>
      </div>
    </form>
  );
}
