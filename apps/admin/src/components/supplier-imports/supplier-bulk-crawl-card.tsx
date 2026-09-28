'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, useEffect, useMemo, useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/form-control';
import { Pagination } from '@/components/ui/pagination';
import { Select } from '@/components/ui/select';
import {
  formatAdminDateTime,
  formatAdminInteger,
  toAsciiDigits,
} from '@/lib/presentation/formatters';
import {
  buildSupplierImportsHref,
  type AdminSupplierCrawlRun,
  type AdminSupplierImportFilters,
  type AdminSupplierImportPage,
  type AdminSupplierImportSource,
  type AdminSupplierSourceCategory,
} from '@/lib/supplier-imports/supplier-imports-model';

type Props = Readonly<{
  sources: readonly AdminSupplierImportSource[];
  categories: readonly AdminSupplierSourceCategory[];
  runs: AdminSupplierImportPage<AdminSupplierCrawlRun>;
  archivedRuns: AdminSupplierImportPage<AdminSupplierCrawlRun>;
  filters: AdminSupplierImportFilters;
  canWrite: boolean;
}>;

async function post(path: string, body: unknown = {}) {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => null)) as { message?: string } | null;
  if (!response.ok) throw new Error(payload?.message ?? 'عملیات انجام نشد.');
}

function runBadge(run: AdminSupplierCrawlRun) {
  if (run.status === 'SUCCEEDED') return <Badge tone="success">تکمیل‌شده</Badge>;
  if (run.status === 'FAILED') return <Badge tone="danger">ناموفق</Badge>;
  if (run.status === 'PARTIAL') return <Badge tone="warning">تکمیل با خطا</Badge>;
  if (run.status === 'PAUSED') return <Badge tone="warning">متوقف‌شده</Badge>;
  return <Badge tone="info">{run.status === 'RUNNING' ? 'در حال اجرا' : 'در صف'}</Badge>;
}

export function SupplierBulkCrawlCard({
  sources,
  categories,
  runs,
  archivedRuns,
  filters,
  canWrite,
}: Props) {
  const router = useRouter();
  const supportedSources = useMemo(() => sources.filter((source) => source.supported), [sources]);
  const [sourceId, setSourceId] = useState(supportedSources[0]?.id ?? '');
  const [categoryId, setCategoryId] = useState('ALL');
  const [mode, setMode] = useState('INITIAL');
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const visibleCategories = categories.filter((category) => category.supplierSourceId === sourceId);
  const active = runs.items.some((run) => ['QUEUED', 'RUNNING'].includes(run.status));
  const visibleRuns = filters.showHistory ? archivedRuns.items : runs.items;

  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => router.refresh(), 10_000);
    return () => window.clearInterval(timer);
  }, [active, router]);

  async function syncCategories() {
    setPending(true);
    setMessage(null);
    try {
      await post('/api/supplier-imports/categories/sync', { supplierSourceId: sourceId });
      setMessage('دسته‌بندی‌های تأمین‌کننده به‌روزرسانی شدند.');
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'همگام‌سازی انجام نشد.');
    } finally {
      setPending(false);
    }
  }

  async function start(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const limit = Number(toAsciiDigits(String(form.get('limit') ?? '100')));
    setPending(true);
    setMessage(null);
    try {
      await post('/api/supplier-imports/bulk-crawls', {
        supplierSourceId: sourceId,
        ...(categoryId === 'ALL' ? {} : { categoryId }),
        limit,
        stopAtKnown: mode === 'SINCE_LAST',
      });
      setMessage('عملیات دریافت گروهی در صف قرار گرفت.');
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'شروع عملیات انجام نشد.');
    } finally {
      setPending(false);
    }
  }

  async function changeRun(runId: string, action: 'pause' | 'resume' | 'archive') {
    setPending(true);
    setMessage(null);
    try {
      await post(`/api/supplier-imports/runs/${runId}/${action}`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تغییر وضعیت انجام نشد.');
    } finally {
      setPending(false);
    }
  }

  return (
    <Card
      title="دریافت گروهی محصولات"
      description="محصولات جدید را از کل فروشگاه یا یک دسته‌بندی تأمین‌کننده دریافت کنید."
    >
      <form className="grid gap-3 lg:grid-cols-5" onSubmit={(event) => void start(event)}>
        <Select
          aria-label="سایت تأمین‌کننده برای دریافت گروهی"
          value={sourceId}
          onValueChange={(value) => {
            setSourceId(value);
            setCategoryId('ALL');
          }}
          options={supportedSources.map((source) => ({
            value: source.id,
            label: `${source.supplierName} — ${source.name}`,
          }))}
          disabled={!canWrite || pending}
        />
        <Select
          aria-label="دسته‌بندی تأمین‌کننده"
          value={categoryId}
          onValueChange={setCategoryId}
          options={[
            { value: 'ALL', label: 'همه محصولات' },
            ...visibleCategories.map((category) => ({ value: category.id, label: category.name })),
          ]}
          disabled={!canWrite || pending}
        />
        <Select
          aria-label="محدوده زمانی دریافت"
          value={mode}
          onValueChange={setMode}
          options={[
            { value: 'INITIAL', label: 'دریافت اولیه / ادامه آرشیو' },
            { value: 'SINCE_LAST', label: 'فقط جدیدها از آخرین Crawl' },
          ]}
          disabled={!canWrite || pending}
        />
        <Input
          aria-label="حداکثر محصولات جدید"
          name="limit"
          inputMode="numeric"
          defaultValue="۱۰۰"
          disabled={!canWrite || pending}
          required
        />
        <Button type="submit" loading={pending} disabled={!canWrite || !sourceId}>
          شروع دریافت
        </Button>
      </form>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => void syncCategories()}
          disabled={!canWrite || !sourceId || pending}
        >
          به‌روزرسانی دسته‌بندی‌ها
        </Button>
        <p className="text-xs leading-6 text-[var(--admin-color-muted)]">
          در حالت «فقط جدیدها»، عملیات پس از رسیدن به چند محصول متوالی که قبلاً دیده شده‌اند متوقف
          می‌شود. تاریخ واقعی انتشار در سایت تأمین‌کننده موجود نیست.
        </p>
      </div>
      {message ? <Alert className="mt-3">{message}</Alert> : null}

      <div id="crawl-history" className="mt-5 border-t border-[var(--admin-color-border)] pt-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Link
              href={buildSupplierImportsHref(filters, { showHistory: false }) + '#crawl-history'}
              className={`inline-flex min-h-9 items-center rounded-[var(--admin-radius-md)] px-3 text-xs font-bold ${
                !filters.showHistory
                  ? 'bg-[var(--admin-color-primary)] !text-white'
                  : 'border border-[var(--admin-color-border)]'
              }`}
            >
              اجراهای جاری ({formatAdminInteger(runs.total)})
            </Link>

            <Link
              href={buildSupplierImportsHref(filters, { showHistory: true }) + '#crawl-history'}
              className={`inline-flex min-h-9 items-center rounded-[var(--admin-radius-md)] px-3 text-xs font-bold ${
                filters.showHistory
                  ? 'bg-[var(--admin-color-primary)] !text-white'
                  : 'border border-[var(--admin-color-border)]'
              }`}
            >
              تاریخچه ({formatAdminInteger(archivedRuns.total)})
            </Link>
          </div>
          {filters.showHistory ? (
            <Select
              aria-label="تعداد اجرای Crawl در هر صفحه"
              value={String(filters.historyPageSize)}
              onValueChange={(value) =>
                router.push(
                  buildSupplierImportsHref(
                    filters,
                    { historyPage: 1, historyPageSize: Number(value), showHistory: true },
                    '#crawl-history',
                  ),
                )
              }
              options={[10, 25, 50].map((value) => ({
                value: String(value),
                label: `${formatAdminInteger(value)} اجرا در صفحه`,
              }))}
              className="w-44"
            />
          ) : null}
        </div>

        {visibleRuns.length ? (
          <div className="space-y-3">
            {visibleRuns.map((run) => {
              const processed = run.succeededCount + run.failedCount;
              const calculatedPercent = run.requestedLimit
                ? Math.min(100, Math.round((processed / run.requestedLimit) * 100))
                : 0;
              const isActive = ['QUEUED', 'RUNNING'].includes(run.status);
              const percent = run.status === 'SUCCEEDED' ? 100 : calculatedPercent;
              const visiblePercent = isActive && percent === 0 ? 2 : percent;
              return (
                <section
                  key={run.id}
                  className="rounded-[var(--admin-radius-md)] border border-[var(--admin-color-border)] p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-bold">
                        {run.supplierName} · {run.categoryName ?? 'همه محصولات'}
                      </p>
                      <p className="mt-1 text-xs text-[var(--admin-color-muted)]">
                        {formatAdminDateTime(run.createdAt)} · صفحه{' '}
                        {formatAdminInteger(run.currentPage)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {runBadge(run)}
                      {['QUEUED', 'RUNNING'].includes(run.status) ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={!canWrite || pending}
                          onClick={() => void changeRun(run.id, 'pause')}
                        >
                          توقف
                        </Button>
                      ) : run.status === 'PAUSED' ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={!canWrite || pending}
                          onClick={() => void changeRun(run.id, 'resume')}
                        >
                          ادامه
                        </Button>
                      ) : !filters.showHistory ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={!canWrite || pending}
                          onClick={() => void changeRun(run.id, 'archive')}
                        >
                          بررسی شد و انتقال به تاریخچه
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  <div
                    className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--admin-color-surface-subtle)]"
                    role="progressbar"
                    aria-label={`پیشرفت دریافت ${run.categoryName ?? 'همه محصولات'}`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={percent}
                  >
                    <div
                      className={`h-full bg-[var(--admin-color-primary)] transition-[width] duration-500 ${isActive && percent === 0 ? 'animate-pulse' : ''}`}
                      style={{ width: `${visiblePercent}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-[var(--admin-color-muted)]">
                    پیشرفت: {formatAdminInteger(percent)}٪ · بررسی‌شده:{' '}
                    {formatAdminInteger(run.discoveredCount)} · جدید:{' '}
                    {formatAdminInteger(run.succeededCount)} · تکراری:{' '}
                    {formatAdminInteger(run.skippedCount)} · خطا:{' '}
                    {formatAdminInteger(run.failedCount)}
                  </p>
                  {run.errorMessage ? (
                    <p className="mt-2 text-xs text-[var(--admin-color-danger)]">
                      {run.errorMessage}
                    </p>
                  ) : null}
                  {filters.showHistory && run.archivedAt ? (
                    <p className="mt-2 text-xs text-[var(--admin-color-muted)]">
                      انتقال به تاریخچه: {formatAdminDateTime(run.archivedAt)}
                      {run.archivedBy ? ` · توسط ${run.archivedBy}` : ''}
                    </p>
                  ) : null}
                </section>
              );
            })}
          </div>
        ) : (
          <p className="rounded-[var(--admin-radius-md)] border border-dashed border-[var(--admin-color-border)] py-8 text-center text-sm text-[var(--admin-color-muted)]">
            {filters.showHistory
              ? 'هنوز اجرایی به تاریخچه منتقل نشده است.'
              : 'اجرای در حال پیگیری وجود ندارد.'}
          </p>
        )}
        {filters.showHistory ? (
          <Pagination
            currentPage={archivedRuns.page}
            totalPages={archivedRuns.totalPages}
            totalItems={archivedRuns.total}
            pageSize={archivedRuns.pageSize}
            getPageHref={(page) =>
              buildSupplierImportsHref(
                filters,
                { historyPage: page, showHistory: true },
                '#crawl-history',
              )
            }
            className="mt-3 px-0"
          />
        ) : null}
        {!filters.showHistory ? (
          <Pagination
            currentPage={runs.page}
            totalPages={runs.totalPages}
            totalItems={runs.total}
            pageSize={runs.pageSize}
            getPageHref={(page) =>
              buildSupplierImportsHref(
                filters,
                { runPage: page, showHistory: false },
                '#crawl-history',
              )
            }
            className="mt-3 px-0"
          />
        ) : null}
      </div>
    </Card>
  );
}
