import { ButtonLink } from '@/components/ui/button';
import { Input } from '@/components/ui/form-control';
import { Select } from '@/components/ui/select';
import { formatAdminInteger } from '@/lib/presentation/formatters';
import type { readEntityFilters } from '@/lib/seo/search-entity-model';
import { searchTypes } from '@/lib/seo/search-overview-model';

export const entitySelect =
  'w-full rounded-md border border-[var(--admin-color-border)] bg-[var(--admin-color-surface)] p-2';
export const entityCell = 'border-b border-[var(--admin-color-border)] px-3 py-2 text-start';
export type EntityFilters = ReturnType<typeof readEntityFilters>;

export function EntityPeriodFields({ filters }: Readonly<{ filters: EntityFilters['detail'] }>) {
  return (
    <>
      <label className="grid gap-1 text-sm">
        از روز میلادی
        <Input type="date" name="startDate" dir="ltr" defaultValue={filters.startDate} required />
      </label>
      <label className="grid gap-1 text-sm">
        تا روز میلادی
        <Input type="date" name="endDate" dir="ltr" defaultValue={filters.endDate} required />
      </label>
      <label className="grid gap-1 text-sm">
        نوع جست‌وجو
        <Select
          name="searchType"
          defaultValue={filters.searchType}
          className={entitySelect}
          aria-label="نوع جست‌وجو"
          options={searchTypes.map(([type, name]) => ({ value: type, label: name }))}
        />
      </label>
      <label className="grid gap-1 text-sm">
        حداقل نمایش
        <Input
          type="number"
          name="minimumImpressions"
          min={1}
          max={1_000_000}
          dir="ltr"
          defaultValue={filters.minimumImpressions}
          required
        />
      </label>
    </>
  );
}

export function EntityPagination({
  page,
  limit,
  total,
  label,
  href,
}: Readonly<{
  page: number;
  limit: number;
  total: number;
  label: string;
  href: (nextPage: number) => string;
}>) {
  const last = Math.max(1, Math.min(5000, Math.ceil(total / limit)));
  if (page === 1 && last === 1) return null;
  return (
    <nav aria-label={label} className="mt-4 flex flex-wrap items-center gap-3">
      {page > 1 ? (
        <ButtonLink variant="outline" href={href(page - 1)}>
          قبلی
        </ButtonLink>
      ) : null}
      <span className="text-sm">
        صفحهٔ {formatAdminInteger(page)} از {formatAdminInteger(last)}
      </span>
      {page < last ? (
        <ButtonLink variant="outline" href={href(page + 1)}>
          بعدی
        </ButtonLink>
      ) : null}
    </nav>
  );
}
