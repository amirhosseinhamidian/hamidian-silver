'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, useMemo, useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/form-control';
import { FormField } from '@/components/ui/form-field';
import { Select } from '@/components/ui/select';
import { formatAdminDateTime, toAsciiDigits } from '@/lib/presentation/formatters';
import type {
  AdminSupplierCrawlSchedule,
  AdminSupplierImportSource,
  AdminSupplierSourceCategory,
} from '@/lib/supplier-imports/supplier-imports-model';

type Props = Readonly<{
  sources: readonly AdminSupplierImportSource[];
  categories: readonly AdminSupplierSourceCategory[];
  schedules: readonly AdminSupplierCrawlSchedule[];
  canWrite: boolean;
}>;

type ScheduleForm = Readonly<{
  isEnabled: boolean;
  timeOfDay: string;
  requestedLimit: number;
  stopAtKnown: boolean;
  monitorKnownProducts: boolean;
  maxRetries: number;
  retryDelayMinutes: number;
  categoryIds: readonly string[];
}>;

const DEFAULT_SCHEDULE: ScheduleForm = {
  isEnabled: false,
  timeOfDay: '02:00',
  requestedLimit: 100,
  stopAtKnown: true,
  monitorKnownProducts: true,
  maxRetries: 2,
  retryDelayMinutes: 15,
  categoryIds: [],
};

function formFor(schedule: AdminSupplierCrawlSchedule | undefined): ScheduleForm {
  return schedule
    ? {
        isEnabled: schedule.isEnabled,
        timeOfDay: schedule.timeOfDay,
        requestedLimit: schedule.requestedLimit,
        stopAtKnown: schedule.stopAtKnown,
        monitorKnownProducts: schedule.monitorKnownProducts,
        maxRetries: schedule.maxRetries,
        retryDelayMinutes: schedule.retryDelayMinutes,
        categoryIds: schedule.categoryIds,
      }
    : DEFAULT_SCHEDULE;
}

function errorMessage(payload: unknown): string {
  if (payload && typeof payload === 'object') {
    const value = (payload as Record<string, unknown>).message;
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) return value.join('، ');
  }
  return 'ذخیره زمان‌بندی انجام نشد.';
}

async function mutate(path: string, method: 'POST' | 'PATCH', body: unknown = {}) {
  const response = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) throw new Error(errorMessage(payload));
}

export function SupplierCrawlScheduleCard({ sources, categories, schedules, canWrite }: Props) {
  const router = useRouter();
  const supportedSources = useMemo(() => sources.filter((source) => source.supported), [sources]);
  const [sourceId, setSourceId] = useState(supportedSources[0]?.id ?? '');
  const saved = schedules.find((schedule) => schedule.supplierSourceId === sourceId);
  const [drafts, setDrafts] = useState<Record<string, ScheduleForm>>({});
  const form = drafts[sourceId] ?? formFor(saved);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const visibleCategories = categories.filter((category) => category.supplierSourceId === sourceId);

  function update(next: Partial<ScheduleForm>) {
    setDrafts((current) => ({ ...current, [sourceId]: { ...form, ...next } }));
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!sourceId) return;
    const data = new FormData(event.currentTarget);
    const requestedLimit = Number(toAsciiDigits(String(data.get('requestedLimit') ?? '')));
    const maxRetries = Number(toAsciiDigits(String(data.get('maxRetries') ?? '')));
    const retryDelayMinutes = Number(toAsciiDigits(String(data.get('retryDelayMinutes') ?? '')));
    setPending(true);
    setMessage(null);
    try {
      await mutate(`/api/supplier-imports/schedules/${sourceId}`, 'PATCH', {
        ...form,
        requestedLimit,
        maxRetries,
        retryDelayMinutes,
      });
      setDrafts((current) => {
        const next = { ...current };
        delete next[sourceId];
        return next;
      });
      setMessage({ tone: 'success', text: 'زمان‌بندی ذخیره شد.' });
      router.refresh();
    } catch (error) {
      setMessage({
        tone: 'danger',
        text: error instanceof Error ? error.message : 'ذخیره زمان‌بندی انجام نشد.',
      });
    } finally {
      setPending(false);
    }
  }

  async function runNow() {
    if (!sourceId || !saved) return;
    setPending(true);
    setMessage(null);
    try {
      await mutate(`/api/supplier-imports/schedules/${sourceId}/run-now`, 'POST');
      setMessage({ tone: 'success', text: 'اجرای زمان‌بندی‌شده در صف قرار گرفت.' });
      router.refresh();
    } catch (error) {
      setMessage({
        tone: 'danger',
        text: error instanceof Error ? error.message : 'اجرای فوری انجام نشد.',
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <Card
      title="زمان‌بندی خودکار Crawl"
      description="اجرای روزانه روی سرور انجام می‌شود و با بستن مرورگر متوقف نخواهد شد."
    >
      {supportedSources.length === 0 ? (
        <Alert tone="warning">منبع پشتیبانی‌شده‌ای برای زمان‌بندی وجود ندارد.</Alert>
      ) : (
        <form key={sourceId} className="space-y-4" onSubmit={(event) => void save(event)}>
          <div className="grid gap-3 lg:grid-cols-4">
            <FormField id="crawl-schedule-source" label="سایت تأمین‌کننده">
              {(props) => (
                <Select
                  {...props}
                  value={sourceId}
                  onValueChange={(value) => {
                    setSourceId(value);
                    setMessage(null);
                  }}
                  options={supportedSources.map((source) => ({
                    value: source.id,
                    label: `${source.supplierName} — ${source.name}`,
                  }))}
                  disabled={!canWrite || pending}
                />
              )}
            </FormField>
            <FormField id="crawl-schedule-time" label="ساعت اجرا (تهران)">
              {(props) => (
                <Input
                  {...props}
                  type="time"
                  value={form.timeOfDay}
                  onChange={(event) => update({ timeOfDay: event.target.value })}
                  disabled={!canWrite || pending}
                  required
                />
              )}
            </FormField>
            <FormField id="crawl-schedule-limit" label="حداکثر محصول در هر اجرا">
              {(props) => (
                <Input
                  {...props}
                  name="requestedLimit"
                  inputMode="numeric"
                  defaultValue={form.requestedLimit}
                  min={1}
                  max={500}
                  disabled={!canWrite || pending}
                  required
                />
              )}
            </FormField>
            <FormField id="crawl-schedule-mode" label="محدوده دریافت">
              {(props) => (
                <Select
                  {...props}
                  value={form.stopAtKnown ? 'NEW' : 'ALL'}
                  onValueChange={(value) => update({ stopAtKnown: value === 'NEW' })}
                  options={[
                    { value: 'NEW', label: 'فقط محصولات جدید' },
                    { value: 'ALL', label: 'ادامه آرشیو تا سقف تعیین‌شده' },
                  ]}
                  disabled={!canWrite || pending}
                />
              )}
            </FormField>
          </div>

          <div>
            <p className="mb-2 text-sm font-bold">دسته‌بندی‌های قابل دریافت</p>
            <div className="grid gap-2 rounded-[var(--admin-radius-md)] border border-[var(--admin-color-border)] p-3 sm:grid-cols-2 lg:grid-cols-3">
              {visibleCategories.map((category) => (
                <Checkbox
                  key={category.id}
                  id={`schedule-category-${category.id}`}
                  label={category.name}
                  checked={form.categoryIds.includes(category.id)}
                  onChange={(event) =>
                    update({
                      categoryIds: event.target.checked
                        ? [...form.categoryIds, category.id]
                        : form.categoryIds.filter((id) => id !== category.id),
                    })
                  }
                  disabled={!canWrite || pending}
                />
              ))}
              {visibleCategories.length === 0 ? (
                <p className="text-xs text-[var(--admin-color-muted)]">
                  ابتدا دسته‌بندی‌های این منبع را به‌روزرسانی کنید. انتخاب خالی یعنی همه محصولات.
                </p>
              ) : null}
            </div>
            <p className="mt-2 text-xs text-[var(--admin-color-muted)]">
              اگر هیچ دسته‌ای انتخاب نشود، همه محصولات منبع دریافت می‌شوند.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Checkbox
              id="crawl-schedule-enabled"
              label="زمان‌بندی فعال باشد"
              description="اجرای بعدی طبق ساعت تهران در صف قرار می‌گیرد."
              checked={form.isEnabled}
              onChange={(event) => update({ isEnabled: event.target.checked })}
              disabled={!canWrite || pending}
            />
            <Checkbox
              id="crawl-schedule-monitor-known"
              label="پایش محصولات قبلی"
              description="قیمت و موجودی منبع را گزارش می‌کند؛ برای پایش کامل، محدوده را روی «ادامه آرشیو» بگذارید."
              checked={form.monitorKnownProducts}
              onChange={(event) => update({ monitorKnownProducts: event.target.checked })}
              disabled={!canWrite || pending}
            />
            <FormField id="crawl-schedule-retries" label="تعداد تلاش مجدد">
              {(props) => (
                <Input
                  {...props}
                  name="maxRetries"
                  inputMode="numeric"
                  defaultValue={form.maxRetries}
                  min={0}
                  max={5}
                  disabled={!canWrite || pending}
                  required
                />
              )}
            </FormField>
            <FormField id="crawl-schedule-retry-delay" label="فاصله تلاش مجدد (دقیقه)">
              {(props) => (
                <Input
                  {...props}
                  name="retryDelayMinutes"
                  inputMode="numeric"
                  defaultValue={form.retryDelayMinutes}
                  min={1}
                  max={1440}
                  disabled={!canWrite || pending}
                  required
                />
              )}
            </FormField>
          </div>

          {saved ? (
            <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-[var(--admin-color-muted)]">
              <span>
                اجرای بعدی: {saved.nextRunAt ? formatAdminDateTime(saved.nextRunAt) : 'غیرفعال'}
              </span>
              <span>
                آخرین ورود به صف:{' '}
                {saved.lastEnqueuedAt
                  ? formatAdminDateTime(saved.lastEnqueuedAt)
                  : 'هنوز اجرا نشده'}
              </span>
              {saved.lastRun ? (
                <Badge tone="info">آخرین وضعیت: {saved.lastRun.status}</Badge>
              ) : null}
            </div>
          ) : null}

          {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" loading={pending} disabled={!canWrite || !sourceId}>
              ذخیره زمان‌بندی
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => void runNow()}
              disabled={!canWrite || !saved || pending}
            >
              اجرای همین حالا
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}
