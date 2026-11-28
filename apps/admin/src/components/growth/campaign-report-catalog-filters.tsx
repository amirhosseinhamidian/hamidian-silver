'use client';

import { useId, useState } from 'react';
import { CampaignProductSearch } from '@/components/campaigns/campaign-product-search';
import { CampaignTaxonomyPicker } from '@/components/campaigns/campaign-taxonomy-picker';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form-control';
import { FormField } from '@/components/ui/form-field';
import { Select } from '@/components/ui/select';
import { useCampaignTaxonomy } from '@/lib/campaigns/campaign-selection';

type CatalogFilter = {
  name: 'category' | 'product';
  value?: string;
  suggestions?: readonly { slug: string; label: string }[];
  pattern?: string;
};

export function CampaignReportCatalogFilters({
  filters,
  canPickCatalog,
  manualLabel,
}: {
  filters: readonly CatalogFilter[];
  canPickCatalog: boolean;
  manualLabel: string;
}) {
  const id = useId();
  const [opened, setOpened] = useState<Partial<Record<CatalogFilter['name'], boolean>>>({});
  const taxonomy = useCampaignTaxonomy(
    canPickCatalog && Boolean(opened.product || opened.category),
  );
  const [chosen, setChosen] = useState(() =>
    Object.fromEntries(filters.map(({ name, value }) => [name, value ?? ''])),
  );
  const [manualPaths, setManualPaths] = useState<Partial<Record<CatalogFilter['name'], string>>>(
    {},
  );
  function select(name: CatalogFilter['name'], value: string) {
    setChosen((current) => ({ ...current, [name]: value }));
    setManualPaths((current) => ({ ...current, [name]: undefined }));
  }

  return filters.map(({ name, suggestions, pattern }) => {
    const fieldId = `${id}-${name}`;
    const label = name === 'category' ? 'دسته‌بندی' : 'محصول';
    const value = chosen[name] ?? '';
    const candidate = manualPaths[name] ?? value;
    const selected = value ? [value] : [];
    const allowedSlug = pattern ? new RegExp(`^(?:${pattern})$`, 'u') : null;
    const validCandidate = !candidate.trim() || !allowedSlug || allowedSlug.test(candidate.trim());
    const categoryTaxonomy =
      taxonomy.data && allowedSlug
        ? {
            ...taxonomy.data,
            categories: taxonomy.data.categories.filter(({ slug }) => allowedSlug.test(slug)),
          }
        : taxonomy.data;
    const manual = (
      <>
        <FormField
          id={fieldId}
          label={`بخش پایانی نشانی ${label}`}
          error={validCandidate ? undefined : 'فقط حرف، عدد، زیرخط و خط تیره وارد کنید.'}
        >
          {(field) => (
            <Input
              {...field}
              value={candidate}
              pattern={canPickCatalog ? undefined : pattern}
              maxLength={pattern ? 180 : 220}
              onChange={(event) => {
                const next = event.currentTarget.value;
                if (canPickCatalog) setManualPaths((current) => ({ ...current, [name]: next }));
                else select(name, next);
              }}
              onKeyDown={(event) => {
                if (canPickCatalog && event.key === 'Enter' && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  if (validCandidate) select(name, candidate.trim());
                }
              }}
            />
          )}
        </FormField>
        {Boolean(suggestions?.length) && (
          <Select
            aria-label={`نشانی‌های پیشنهادی ${label}`}
            placeholder="انتخاب نشانی پیشنهادی"
            value=""
            options={(suggestions ?? []).map(({ slug, label }) => ({ value: slug, label }))}
            onValueChange={(slug) => {
              if (canPickCatalog) setManualPaths((current) => ({ ...current, [name]: slug }));
              else select(name, slug);
            }}
          />
        )}
        {canPickCatalog && (
          <Button
            size="sm"
            variant="outline"
            disabled={candidate === value || !validCandidate}
            onClick={() => select(name, candidate.trim())}
          >
            اعمال این نشانی
          </Button>
        )}
      </>
    );

    return (
      <div key={name} className="min-w-0 space-y-2">
        <input type="hidden" name={name} value={value} />
        {canPickCatalog && (
          <details
            className="space-y-2"
            onToggle={(event) => {
              if (event.currentTarget.open)
                setOpened((current) => (current[name] ? current : { ...current, [name]: true }));
            }}
          >
            <summary className="cursor-pointer text-sm font-semibold">
              انتخاب {label} {value && <bdi className="font-normal">{value}</bdi>}
            </summary>
            {opened[name] && name === 'product' && (
              <CampaignProductSearch
                taxonomy={taxonomy.data}
                max={1}
                selected={selected}
                onSelect={(slug) => select(name, slug)}
                onRemove={() => select(name, '')}
              />
            )}
            {opened[name] &&
              name === 'category' &&
              (categoryTaxonomy ? (
                <CampaignTaxonomyPicker
                  taxonomy={categoryTaxonomy}
                  kind="categories"
                  categoryMode="direct"
                  max={1}
                  selected={selected}
                  onChange={([slug]) => select(name, slug ?? '')}
                />
              ) : taxonomy.failed ? (
                <Alert
                  tone="danger"
                  action={
                    <Button variant="outline" size="sm" onClick={taxonomy.retry}>
                      تلاش دوباره
                    </Button>
                  }
                >
                  دریافت دسته‌بندی‌ها ممکن نشد.
                </Alert>
              ) : (
                <p role="status" className="text-sm">
                  در حال دریافت دسته‌بندی‌ها…
                </p>
              ))}
          </details>
        )}
        {canPickCatalog ? (
          <details className="space-y-2 text-sm">
            <summary className="cursor-pointer underline">{manualLabel}</summary>
            {manual}
          </details>
        ) : (
          manual
        )}
      </div>
    );
  });
}
