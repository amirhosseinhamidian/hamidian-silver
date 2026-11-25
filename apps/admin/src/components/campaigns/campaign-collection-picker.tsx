'use client';

import type { components } from '@hamidian/contracts';
import { useId, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form-control';
import { useCampaignSelection } from '@/lib/campaigns/campaign-selection';

type Filters = components['schemas']['CampaignCollectionFiltersDto'];
type Editor = components['schemas']['CampaignLandingEditorDto'];

export function CampaignCollectionPicker({
  campaignId,
  disabled,
  onApply,
}: {
  campaignId: string;
  disabled?: boolean;
  onApply: (filters: Filters) => void;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pending, setPending] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ message: string; failed?: boolean } | null>(null);
  const q = query.trim();
  const data = useCampaignSelection<components['schemas']['CampaignCollectionOptionsDto']>(
    open && q.length !== 1
      ? `/api/campaigns/collection-options?${new URLSearchParams({ ...(q ? { q } : {}), page: String(page) })}`
      : null,
    250,
  );
  const items = data.data?.items.filter(({ id }) => id !== campaignId);

  async function apply(source: string, name: string) {
    if (pending || disabled) return;
    setPending(source);
    setNotice(null);
    try {
      const response = await fetch(`/api/campaigns/${source}/landing`, { cache: 'no-store' });
      if (!response.ok) throw new Error('Collection unavailable.');
      const { landing } = (await response.json()) as Editor;
      if (landing?.collectionMode !== 'FILTERED') throw new Error('Collection unavailable.');
      onApply(landing.filters);
      setNotice({ message: `قواعد «${name}» در پیش‌نویس کپی شد.` });
    } catch {
      setNotice({ message: 'دریافت قواعد مجموعه ممکن نشد.', failed: true });
    } finally {
      setPending(null);
    }
  }

  return (
    <details
      className="space-y-2 rounded-lg border border-[var(--admin-color-border)] p-3"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="cursor-pointer text-sm font-semibold">
        استفاده از قواعد یک مجموعهٔ هوشمند
      </summary>
      <p className="text-xs text-[var(--admin-color-muted)]">
        قواعد فعلی از مجموعهٔ انتخابی جایگزین می‌شوند. محصولات همچنان بر اساس کاتالوگ و دامنهٔ همین
        جشنواره انتخاب می‌شوند.
      </p>
      <label htmlFor={id} className="text-xs">
        عنوان یا اسلاگ مجموعه
      </label>
      <Input
        id={id}
        type="search"
        value={query}
        maxLength={96}
        disabled={disabled || Boolean(pending)}
        onChange={(event) => {
          setQuery(event.currentTarget.value);
          setPage(1);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.nativeEvent.isComposing) event.preventDefault();
        }}
      />
      {data.loading && (
        <p role="status" className="text-xs">
          در حال دریافت مجموعه‌ها…
        </p>
      )}
      {q.length === 1 && (
        <p role="status" className="text-xs">
          دست‌کم دو نویسه وارد کنید.
        </p>
      )}
      {data.failed && (
        <Alert tone="danger">
          دریافت مجموعه‌ها ممکن نشد.{' '}
          <Button size="sm" variant="outline" onClick={data.retry}>
            تلاش دوباره
          </Button>
        </Alert>
      )}
      {items?.length === 0 && (
        <p role="status" className="text-xs">
          مجموعه‌ای پیدا نشد.
        </p>
      )}
      {items?.length ? (
        <ul className="space-y-2">
          {items.map(({ id, name }) => (
            <li key={id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
              {name}
              <Button
                size="sm"
                variant="outline"
                disabled={disabled || Boolean(pending)}
                loading={pending === id}
                onClick={() => void apply(id, name)}
              >
                کپی قواعد
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      {data.data && (page > 1 || data.data.hasMore) && (
        <nav aria-label="صفحه‌بندی مجموعه‌ها" className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={disabled || Boolean(pending) || page === 1}
            onClick={() => setPage(page - 1)}
          >
            صفحهٔ قبل
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={disabled || Boolean(pending) || !data.data.hasMore || page >= 1000}
            onClick={() => setPage(page + 1)}
          >
            صفحهٔ بعد
          </Button>
        </nav>
      )}
      {notice &&
        (notice.failed ? (
          <Alert tone="danger">{notice.message}</Alert>
        ) : (
          <p role="status" className="text-sm">
            {notice.message}
          </p>
        ))}
    </details>
  );
}
