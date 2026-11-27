'use client';

import { useId, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form-control';
import { FormField } from '@/components/ui/form-field';
import { Select } from '@/components/ui/select';
import { useCampaignTaxonomy } from '@/lib/campaigns/campaign-selection';
import { CampaignCollectionPicker } from './campaign-collection-picker';
import { CampaignProductSearch } from './campaign-product-search';
import { CampaignTaxonomyPicker } from './campaign-taxonomy-picker';

const destinations = [
  { value: '/', label: 'صفحهٔ اصلی' },
  { value: '/products', label: 'فهرست محصولات' },
  { value: '/categories', label: 'فهرست دسته‌بندی‌ها' },
  { value: '/brands', label: 'فهرست برندها' },
  { value: '/guide', label: 'دانستنی‌ها' },
  { value: '/gift-finder', label: 'راهنمای انتخاب هدیه' },
  { value: 'products', label: 'یک محصول' },
  { value: 'categories', label: 'یک دسته‌بندی' },
  { value: 'brands', label: 'یک برند' },
  { value: 'campaigns', label: 'صفحهٔ فعال کمپین' },
  { value: 'custom', label: 'مسیر عمومی دیگر' },
];

function catalogDestination(path: string) {
  const match = /^\/(products|categories|brands|campaigns)\/([^/?#]+)$/.exec(path);
  if (!match) return null;
  try {
    const slug = decodeURIComponent(match[2]);
    return /[\/\\\p{Cc}]/u.test(slug) ? null : { collection: match[1], slug };
  } catch {
    return null;
  }
}

export function CampaignDestinationPicker({
  name,
  label = 'مقصد کمپین',
  defaultValue = '',
  value,
  onChange,
  required = false,
  disabled = false,
  error,
  hint,
  maxLength = 1000,
}: {
  name?: string;
  label?: string;
  defaultValue?: string;
  value?: string;
  onChange?: (path: string) => void;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  hint?: string;
  maxLength?: number;
}) {
  const id = useId();
  const [localValue, setLocalValue] = useState(defaultValue);
  const path = value ?? localValue;
  const [mode, setMode] = useState(() => {
    const initial = value ?? defaultValue;
    if (destinations.some((option) => option.value === initial && initial.startsWith('/')))
      return initial;
    return catalogDestination(initial)?.collection ?? 'custom';
  });
  const taxonomy = useCampaignTaxonomy(mode === 'categories' || mode === 'brands');
  const selected = catalogDestination(path);
  const selectedSlugs = selected?.collection === mode ? [selected.slug] : [];
  const [selectionError, setSelectionError] = useState<string>();
  const fieldError = error ?? selectionError;

  function change(next: string) {
    if (next.length > maxLength) {
      setSelectionError('این نشانی از سقف طول مجاز مقصد بیشتر است.');
      return;
    }
    setSelectionError(undefined);
    if (value === undefined) setLocalValue(next);
    onChange?.(next);
  }

  return (
    <div className="min-w-0 space-y-3" data-campaign-field={name} tabIndex={name ? -1 : undefined}>
      {name && <input type="hidden" name={name} value={path} disabled={disabled} />}
      <FormField
        id={id}
        label={label}
        error={mode !== 'custom' ? fieldError : undefined}
        hint={hint}
        required={required}
      >
        {(field) => (
          <Select
            {...field}
            value={mode}
            options={destinations}
            disabled={disabled}
            onValueChange={(next) => {
              setMode(next);
              if (next !== 'custom') change(next.startsWith('/') ? next : '');
            }}
          />
        )}
      </FormField>
      {mode === 'products' && (
        <CampaignProductSearch
          max={1}
          disabled={disabled}
          selected={selectedSlugs}
          onSelect={(slug) => change(`/products/${encodeURIComponent(slug)}`)}
          onRemove={() => change('')}
        />
      )}
      {(mode === 'categories' || mode === 'brands') &&
        (taxonomy.data ? (
          <CampaignTaxonomyPicker
            taxonomy={taxonomy.data}
            kind={mode}
            describeScope={false}
            max={1}
            selected={selectedSlugs}
            disabled={disabled}
            onChange={([slug]) => change(slug ? `/${mode}/${encodeURIComponent(slug)}` : '')}
          />
        ) : taxonomy.failed ? (
          <Alert
            tone="danger"
            action={
              <Button variant="outline" disabled={disabled} onClick={taxonomy.retry}>
                تلاش دوباره
              </Button>
            }
          >
            دریافت مقصدها ممکن نشد.
          </Alert>
        ) : (
          <p role="status" className="text-sm">
            در حال دریافت مقصدها…
          </p>
        ))}
      {mode === 'campaigns' && (
        <CampaignCollectionPicker
          selectedSlug={selectedSlugs[0]}
          disabled={disabled}
          onSelect={({ slug }) => change(`/campaigns/${encodeURIComponent(slug)}`)}
        />
      )}
      {mode === 'custom' ? (
        <FormField
          id={`${id}-path`}
          label="مسیر عمومی مقصد"
          error={fieldError}
          hint="مانند ‎/guide‎ یا نشانی یک صفحهٔ فعال فروشگاه."
          required={required}
        >
          {(field) => (
            <Input
              {...field}
              dir="ltr"
              value={path}
              onChange={(event) => change(event.currentTarget.value)}
              maxLength={maxLength}
              disabled={disabled}
              required={required}
            />
          )}
        </FormField>
      ) : path ? (
        <div className="flex flex-wrap items-center gap-2 text-xs [overflow-wrap:anywhere]">
          <bdi>{path}</bdi>
          {(!required || mode === 'campaigns') && (
            <Button
              variant="ghost"
              size="sm"
              disabled={disabled}
              onClick={() => {
                if (mode !== 'campaigns') setMode('custom');
                change('');
              }}
            >
              پاک کردن مقصد
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}
