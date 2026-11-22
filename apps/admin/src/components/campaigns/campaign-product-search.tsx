'use client';

import type { components } from '@hamidian/contracts';
import { useId, useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form-control';
import { FormField } from '@/components/ui/form-field';

type ProductOptions = components['schemas']['CampaignProductOptionsDto'];

export function CampaignProductSearch({
  selected,
  onSelect,
  disabled = false,
}: {
  selected: readonly string[];
  onSelect: (slug: string) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<ProductOptions | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function search() {
    if (busy || query.trim().length < 2) return;
    setBusy(true);
    setError(false);
    setResult(null);
    try {
      const response = await fetch(
        `/api/campaigns/product-options?${new URLSearchParams({ q: query.trim() })}`,
      );
      if (!response.ok) throw new Error('Product search failed.');
      setResult((await response.json()) as ProductOptions);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <FormField id={id} label="جست‌وجوی محصول" hint="حداقل دو نویسه از نام یا اسلاگ را وارد کنید.">
        {(props) => (
          <div className="flex flex-wrap gap-2">
            <Input
              {...props}
              type="search"
              className="min-w-40 flex-1"
              value={query}
              maxLength={96}
              disabled={busy || disabled}
              onChange={(event) => {
                setQuery(event.currentTarget.value);
                setResult(null);
                setError(false);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  void search();
                }
              }}
            />
            <Button
              type="button"
              variant="outline"
              loading={busy}
              disabled={disabled || query.trim().length < 2}
              onClick={() => void search()}
            >
              جست‌وجو
            </Button>
          </div>
        )}
      </FormField>
      {error && <Alert tone="danger">جست‌وجوی محصول ممکن نشد.</Alert>}
      {result &&
        (result.items.length === 0 ? (
          <p role="status" className="text-sm">
            محصول فعالی با این عبارت پیدا نشد.
          </p>
        ) : (
          <ul aria-label="نتایج جست‌وجوی محصول" className="space-y-1">
            {result.items.map(({ slug, name }) => (
              <li key={slug} className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm">
                  {name} · <bdi>{slug}</bdi>
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  aria-label={`انتخاب ${name}`}
                  disabled={disabled || selected.includes(slug)}
                  onClick={() => onSelect(slug)}
                >
                  {selected.includes(slug) ? 'انتخاب‌شده' : 'انتخاب'}
                </Button>
              </li>
            ))}
          </ul>
        ))}
    </div>
  );
}
