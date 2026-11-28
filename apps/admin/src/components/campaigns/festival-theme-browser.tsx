'use client';

import type { components } from '@hamidian/contracts';
import { useId, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form-control';
import { Select } from '@/components/ui/select';
import { useCampaignSelection } from '@/lib/campaigns/campaign-selection';
import { formatAdminDateTime, formatAdminInteger } from '@/lib/presentation/formatters';
import { FestivalThemePreview, type FestivalTheme } from './festival-theme-fields';

type List = components['schemas']['FestivalThemeLibraryListDto'];
type History = components['schemas']['FestivalThemeLibraryHistoryDto'];
export type ThemeChoice = Readonly<{
  name: string;
  theme: FestivalTheme;
  version: number;
  templateVersion: number;
  description: string | null;
  archivedAt: string | null;
  updatedAt: string | null;
  preset?: true;
}>;

function ThemePages({
  page,
  hasMore,
  onChange,
  label,
}: {
  page: number;
  hasMore: boolean;
  onChange: (page: number) => void;
  label: string;
}) {
  if (!hasMore && page === 1) return null;
  return (
    <nav aria-label={label} className="flex flex-wrap items-center gap-2">
      <Button size="sm" variant="outline" disabled={page === 1} onClick={() => onChange(page - 1)}>
        صفحهٔ قبل
      </Button>
      <span className="text-xs">صفحهٔ {formatAdminInteger(page)}</span>
      <Button
        size="sm"
        variant="outline"
        disabled={!hasMore || page >= 1000}
        onClick={() => onChange(page + 1)}
      >
        صفحهٔ بعد
      </Button>
    </nav>
  );
}

export function FestivalThemeBrowser({
  manage = false,
  onChoose,
}: {
  manage?: boolean;
  onChoose: (choice: ThemeChoice) => void;
}) {
  const id = useId();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'active' | 'archived'>('active');
  const [page, setPage] = useState(1);
  const [historyName, setHistoryName] = useState('');
  const [historyPage, setHistoryPage] = useState(1);
  const q = query.trim();
  const data = useCampaignSelection<List>(
    `/api/festival-themes?${new URLSearchParams({ ...(q ? { q } : {}), status, page: String(page) })}`,
    200,
  );
  const history = useCampaignSelection<History>(
    historyName
      ? `/api/festival-themes/history?${new URLSearchParams({ name: historyName, page: String(historyPage) })}`
      : null,
  );
  const choices: ThemeChoice[] = [
    ...(data.data?.presets.map((preset) => ({
      ...preset,
      version: 1,
      templateVersion: 1,
      preset: true as const,
      description: null,
      archivedAt: null,
      updatedAt: null,
    })) ?? []),
    ...(data.data?.items.map((theme) => ({ ...theme, templateVersion: theme.version })) ?? []),
  ];

  function changeHistory(name: string) {
    setHistoryName(name === historyName ? '' : name);
    setHistoryPage(1);
  }

  return (
    <section className="space-y-4" aria-label="فهرست تم‌ها">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1 space-y-1">
          <label htmlFor={`${id}-search`} className="text-xs">
            جست‌وجوی نام تم
          </label>
          <Input
            id={`${id}-search`}
            type="search"
            maxLength={80}
            value={query}
            onChange={(event) => {
              setQuery(event.currentTarget.value);
              setPage(1);
              changeHistory('');
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.nativeEvent.isComposing) event.preventDefault();
            }}
          />
        </div>
        {manage && (
          <label className="grid gap-1 text-xs">
            وضعیت تم
            <Select
              className="min-h-10 rounded-md border px-2"
              value={status}
              onValueChange={(value) => {
                setStatus(value === 'archived' ? 'archived' : 'active');
                setPage(1);
                changeHistory('');
              }}
              aria-label="وضعیت تم"
              options={[
                { value: 'active', label: 'قابل استفاده' },
                { value: 'archived', label: 'بایگانی‌شده' },
              ]}
            />
          </label>
        )}
      </div>
      {data.loading && (
        <p role="status" className="text-sm">
          در حال دریافت تم‌ها…
        </p>
      )}
      {data.failed && (
        <Alert tone="danger">
          دریافت تم‌ها ممکن نشد.{' '}
          <Button size="sm" variant="outline" onClick={data.retry}>
            تلاش دوباره
          </Button>
        </Alert>
      )}
      {data.data && choices.length === 0 && (
        <p role="status" className="text-sm">
          تمی در این صفحه پیدا نشد.
        </p>
      )}
      {choices.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2">
          {choices.map((choice) => (
            <li key={choice.name} className="min-w-0 space-y-2 rounded-lg border p-2.5">
              <FestivalThemePreview theme={choice.theme} name={choice.name} />
              <p className="text-xs text-[var(--admin-color-muted)]">
                {choice.preset
                  ? 'تم آماده'
                  : `نسخهٔ ${formatAdminInteger(choice.version)} · ${formatAdminDateTime(choice.updatedAt!)}`}
              </p>
              {choice.description && (
                <p className="text-xs [overflow-wrap:anywhere]">{choice.description}</p>
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  aria-label={`${manage ? 'مشاهده' : 'انتخاب'} ${choice.name}`}
                  onClick={() => onChoose(choice)}
                >
                  {manage ? 'مشاهده و مدیریت' : 'انتخاب تم'}
                </Button>
                {!choice.preset && (
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-expanded={historyName === choice.name}
                    aria-label={`نسخه‌های ${choice.name}`}
                    onClick={() => changeHistory(choice.name)}
                  >
                    نسخه‌ها
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {data.data && (
        <ThemePages
          label="صفحه‌بندی تم‌ها"
          page={page}
          hasMore={data.data.hasMore}
          onChange={(next) => {
            setPage(next);
            changeHistory('');
          }}
        />
      )}
      {historyName && (
        <section className="space-y-3 rounded-lg border p-3" aria-label="تاریخچهٔ تم">
          <h3 className="text-sm font-semibold [overflow-wrap:anywhere]">نسخه‌های {historyName}</h3>
          {history.loading && (
            <p role="status" className="text-sm">
              در حال دریافت نسخه‌ها…
            </p>
          )}
          {history.failed && (
            <Alert tone="danger">
              دریافت نسخه‌ها ممکن نشد.{' '}
              <Button size="sm" variant="outline" onClick={history.retry}>
                تلاش دوباره
              </Button>
            </Alert>
          )}
          {history.data && (
            <>
              {history.data.items.length === 0 && (
                <p role="status" className="text-sm">
                  نسخه‌ای در این صفحه وجود ندارد.
                </p>
              )}
              <ul className="grid gap-2 sm:grid-cols-2">
                {history.data.items.map(({ version, theme, description, createdAt }) => {
                  const template = history.data!.template;
                  const title = `نسخهٔ ${formatAdminInteger(version)}`;
                  return (
                    <li key={version} className="space-y-2 rounded-lg border p-2">
                      <FestivalThemePreview name={title} theme={theme} />
                      <p className="text-xs text-[var(--admin-color-muted)]">
                        {formatAdminDateTime(createdAt)}
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!manage && Boolean(template.archivedAt)}
                        aria-label={`${manage ? 'مشاهده' : 'انتخاب'} ${title}`}
                        onClick={() =>
                          onChoose({
                            ...template,
                            version,
                            theme,
                            description,
                            updatedAt: createdAt,
                            templateVersion: template.version,
                          })
                        }
                      >
                        {manage ? 'مشاهدهٔ نسخه' : 'انتخاب نسخه'}
                      </Button>
                    </li>
                  );
                })}
              </ul>
              <ThemePages
                label="صفحه‌بندی نسخه‌های تم"
                page={historyPage}
                hasMore={history.data.hasMore}
                onChange={setHistoryPage}
              />
            </>
          )}
        </section>
      )}
    </section>
  );
}
