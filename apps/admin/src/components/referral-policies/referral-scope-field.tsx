'use client';

import { useId, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form-control';
import { FormField } from '@/components/ui/form-field';
import { Select } from '@/components/ui/select';
import { useCampaignSelection } from '@/lib/campaigns/campaign-selection';
import { formatAdminInteger } from '@/lib/presentation/formatters';

type Scope = { id: string; name: string };

export function ReferralScopeField({
  name,
  label,
  kind,
  values = [],
  max = 50,
}: Readonly<{
  name: string;
  label: string;
  kind: 'category' | 'campaign';
  values?: readonly string[];
  max?: number;
}>) {
  const id = useId();
  const [selected, setSelected] = useState<string[]>(() => [...values]);
  const [query, setQuery] = useState('');
  const [known, setKnown] = useState<Record<string, string>>({});
  const path = '/api/referral-reward-policies/scopes';
  const term = query.trim();
  const results = useCampaignSelection<Scope[]>(
    term ? `${path}?${new URLSearchParams({ kind, q: term })}` : null,
    250,
  );
  const old = useCampaignSelection<Scope[]>(
    values.length ? `${path}?${new URLSearchParams({ kind, ids: values.join(',') })}` : null,
  );
  const names = new Map(old.data?.map(({ id, name }) => [id, name]));
  const options = (results.data ?? []).filter(({ id }) => !selected.includes(id));

  return (
    <fieldset className="min-w-0 space-y-2">
      <legend className="text-sm font-semibold">{label}</legend>
      <input type="hidden" name={name} value={selected.join(',')} />
      {selected.length > 0 && (
        <ul className="space-y-1">
          {selected.map((value, index) => {
            const item =
              known[value] ?? names.get(value) ?? `انتخاب قبلی ${formatAdminInteger(index + 1)}`;
            return (
              <li key={value} className="flex flex-wrap items-center gap-2 text-sm">
                <span>{item}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={`حذف ${item}`}
                  onClick={() =>
                    setSelected((current) => current.filter((entry) => entry !== value))
                  }
                >
                  حذف
                </Button>
              </li>
            );
          })}
        </ul>
      )}
      {selected.length < max && (
        <FormField id={id} label={`جست‌وجوی ${kind === 'category' ? 'دسته' : 'کمپین'} با نام`}>
          {(props) => (
            <Input
              {...props}
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
              maxLength={80}
              type="search"
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.nativeEvent.isComposing) event.preventDefault();
              }}
            />
          )}
        </FormField>
      )}
      {selected.length < max && options.length > 0 && (
        <Select
          aria-label={`انتخاب از نتایج ${label}`}
          placeholder="انتخاب از نتایج"
          value=""
          options={options.map(({ id, name }) => ({ value: id, label: name }))}
          onValueChange={(value) => {
            const item = options.find((option) => option.id === value);
            if (!item) return;
            setSelected((current) => [...new Set([...current, value])].slice(0, max));
            setKnown((current) => ({ ...current, [value]: item.name }));
            setQuery('');
          }}
        />
      )}
      {(results.loading || old.loading) && (
        <p role="status" className="text-sm">
          در حال دریافت گزینه‌ها…
        </p>
      )}
      {results.data && !options.length && (
        <p role="status" className="text-sm">
          گزینهٔ تازه‌ای یافت نشد.
        </p>
      )}
      {(results.failed || old.failed) && (
        <Alert tone="danger">
          دریافت گزینه‌ها انجام نشد.{' '}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              results.retry();
              old.retry();
            }}
          >
            تلاش دوباره
          </Button>
        </Alert>
      )}
    </fieldset>
  );
}
