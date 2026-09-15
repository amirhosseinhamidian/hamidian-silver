'use client';

import { useMemo, useState, type FormEvent } from 'react';

import { Alert } from '@/components/ui/alert';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { DataTableColumn } from '@/components/ui/data-table';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { DonutChart } from '@/components/ui/donut-chart';
import { FilterBar, SearchField } from '@/components/ui/filter-bar';
import { Textarea } from '@/components/ui/form-control';
import { MobileDataCard } from '@/components/ui/mobile-data-card';
import { ResponsiveDataView } from '@/components/ui/responsive-data-view';
import { Select } from '@/components/ui/select';
import {
  parseNotificationOutboxSnapshot,
  type NotificationOutboxItem,
  type NotificationOutboxSnapshot,
  type NotificationOutboxSource,
  type NotificationOutboxStatus,
  type NotificationRecoveryResolution,
} from '@/lib/notification-outbox/notification-outbox-model';
import {
  formatAdminDateTime,
  formatAdminInteger,
  formatAdminPhone,
  toAsciiDigits,
  toPersianDigits,
} from '@/lib/presentation/formatters';

type Props = Readonly<{
  snapshot: NotificationOutboxSnapshot | null;
  failed: boolean;
  canRecover: boolean;
}>;
type DetailMode = 'desktop' | 'mobile' | null;
type SourceFilter = 'all' | NotificationOutboxSource;
type StatusFilter = 'all' | NotificationOutboxStatus;
type Action = Readonly<{ kind: 'retry' | 'resolve'; item: NotificationOutboxItem }>;

const STATUS: Record<NotificationOutboxStatus, Readonly<{ label: string; tone: BadgeTone }>> = {
  PENDING: { label: 'در انتظار', tone: 'info' },
  PROCESSING: { label: 'در پردازش', tone: 'warning' },
  DISPATCHING: { label: 'در حال ارسال', tone: 'warning' },
  SENT: { label: 'ارسال‌شده', tone: 'success' },
  FAILED: { label: 'ناموفق', tone: 'danger' },
  UNKNOWN: { label: 'نامشخص', tone: 'danger' },
};

const EVENT_LABELS: Readonly<Record<string, string>> = {
  PAYMENT_VERIFIED: 'تأیید پرداخت',
  SHIPMENT_TRACKING_AVAILABLE: 'کد رهگیری آماده',
  ORDER_SHIPPED: 'ارسال سفارش',
  ORDER_DELIVERED: 'تحویل سفارش',
  PAYMENT_RECONCILIATION_REQUIRED: 'نیازمند مغایرت‌گیری پرداخت',
  STOCK_AVAILABLE: 'موجودشدن کالا',
};

function eventLabel(item: NotificationOutboxItem): string {
  return EVENT_LABELS[item.eventType] ?? item.eventType.replaceAll('_', ' ');
}

function SourceBadge({ source }: Readonly<{ source: NotificationOutboxSource }>) {
  return (
    <Badge tone={source === 'CUSTOMER' ? 'info' : 'warning'}>
      {source === 'CUSTOMER' ? 'پیام مشتری' : 'هشدار عملیاتی'}
    </Badge>
  );
}

function StatusBadge({ status }: Readonly<{ status: NotificationOutboxStatus }>) {
  const meta = STATUS[status];
  return (
    <Badge tone={meta.tone} dot>
      {meta.label}
    </Badge>
  );
}

function Kpi({ label, value, tone }: Readonly<{ label: string; value: number; tone: BadgeTone }>) {
  return (
    <Card>
      <Badge tone={tone}>{label}</Badge>
      <p className="mt-3 text-2xl font-black">{formatAdminInteger(value)}</p>
    </Card>
  );
}

function DetailRows({ rows }: Readonly<{ rows: readonly (readonly [string, string])[] }>) {
  return (
    <dl className="divide-y divide-[var(--admin-color-border)]">
      {rows.map(([label, value]) => (
        <div key={label} className="flex justify-between gap-4 py-2.5 text-xs sm:text-sm">
          <dt className="text-[var(--admin-color-muted)]">{label}</dt>
          <dd className="max-w-[68%] text-left font-semibold break-words">
            {toPersianDigits(value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function OutboxDetails({ item }: Readonly<{ item: NotificationOutboxItem }>) {
  return (
    <div className="space-y-4">
      {item.lastError ? (
        <Alert tone={item.status === 'UNKNOWN' ? 'warning' : 'danger'} title="آخرین خطای ارسال">
          {item.lastError}
        </Alert>
      ) : null}
      <Card title="چرخه ارسال">
        <DetailRows
          rows={[
            ['منبع', item.source === 'CUSTOMER' ? 'پیام مشتری' : 'هشدار عملیاتی'],
            ['نوع رویداد', eventLabel(item)],
            ['وضعیت', STATUS[item.status].label],
            ['تعداد تلاش', formatAdminInteger(item.attempts)],
            ['زمان ایجاد', formatAdminDateTime(item.createdAt)],
            ['آخرین تغییر', formatAdminDateTime(item.updatedAt)],
            ['تلاش بعدی', formatAdminDateTime(item.nextAttemptAt)],
            ['پایان ارسال', item.processedAt ? formatAdminDateTime(item.processedAt) : 'ثبت نشده'],
          ]}
        />
      </Card>
      <Card title="ارجاع دامنه">
        <DetailRows
          rows={[
            ['نوع مرجع', item.aggregateType],
            ['شناسه مرجع', item.aggregateId],
            [
              'گیرنده',
              item.recipientPhone ? formatAdminPhone(item.recipientPhone) : 'در payload امن',
            ],
            ['اولویت', item.priority ?? 'عادی'],
            ['سطح هشدار', item.level ?? 'ندارد'],
          ]}
        />
      </Card>
      <Card title="تاریخچه recovery" description="آخرین تصمیم‌های دستی ثبت‌شده برای این پیام">
        {item.recoveries.length ? (
          <ol className="space-y-3">
            {item.recoveries.map((recovery) => (
              <li
                key={recovery.id}
                className="rounded-[var(--admin-radius-md)] border border-[var(--admin-color-border)] p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Badge tone={recovery.resolution === 'MARKED_SENT' ? 'success' : 'info'}>
                    {recovery.resolution === 'MARKED_SENT'
                      ? 'ثبت به‌عنوان ارسال‌شده'
                      : 'اجازه تلاش مجدد'}
                  </Badge>
                  <span className="text-xs text-[var(--admin-color-muted)]">
                    {formatAdminDateTime(recovery.createdAt)}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6">{recovery.note}</p>
                {recovery.unknownReasonSnapshot ? (
                  <p className="mt-2 text-xs leading-5 text-[var(--admin-color-muted)]">
                    خطای ثبت‌شده: {recovery.unknownReasonSnapshot}
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-[var(--admin-color-muted)]">اقدام recovery ثبت نشده است.</p>
        )}
      </Card>
    </div>
  );
}

function errorMessage(status: number): string {
  if (status === 401) return 'نشست مدیریتی منقضی شده است. دوباره وارد شوید.';
  if (status === 403) return 'مجوز بازیابی صف ارسال را ندارید.';
  if (status === 404) return 'رویداد موردنظر پیدا نشد.';
  if (status === 409) return 'وضعیت پیام تغییر کرده است؛ صفحه را تازه‌سازی کنید.';
  if (status === 400 || status === 422) return 'یادداشت یا تصمیم recovery معتبر نیست.';
  return 'عملیات بازیابی پیام انجام نشد. دوباره تلاش کنید.';
}

export function NotificationOutboxView({ snapshot, failed, canRecover }: Props) {
  const [data, setData] = useState(snapshot);
  const [search, setSearch] = useState('');
  const [source, setSource] = useState<SourceFilter>('all');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [selected, setSelected] = useState<NotificationOutboxItem | null>(null);
  const [detailMode, setDetailMode] = useState<DetailMode>(null);
  const [action, setAction] = useState<Action | null>(null);
  const [resolution, setResolution] = useState<NotificationRecoveryResolution>('RETRY_APPROVED');
  const [note, setNote] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const needle = toAsciiDigits(search).trim().toLocaleLowerCase('fa');

  const filtered = useMemo(
    () =>
      (data?.items ?? []).filter((item) => {
        if (source !== 'all' && item.source !== source) return false;
        if (status !== 'all' && item.status !== status) return false;
        if (!needle) return true;
        return [
          eventLabel(item),
          item.eventType,
          item.aggregateId,
          item.recipientPhone ?? '',
          item.lastError ?? '',
        ].some((value) => toAsciiDigits(value).toLocaleLowerCase('fa').includes(needle));
      }),
    [data, needle, source, status],
  );

  function closeDetails() {
    setSelected(null);
    setDetailMode(null);
  }
  function openDetails(item: NotificationOutboxItem, mode: Exclude<DetailMode, null>) {
    setSelected(item);
    setDetailMode(mode);
  }
  function openAction(next: Action) {
    closeDetails();
    setAction(next);
    setNote('');
    setResolution('RETRY_APPROVED');
    setError('');
    setSuccess('');
  }
  function closeAction() {
    if (!pending) {
      setAction(null);
      setError('');
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!action || pending) return;
    if (note.trim().length < 3) {
      setError('یادداشت اقدام باید حداقل ۳ کاراکتر باشد.');
      return;
    }
    const sourcePath = action.item.source.toLocaleLowerCase('en-US');
    const endpoint = `/api/notification-outbox/${sourcePath}/${encodeURIComponent(action.item.id)}/${action.kind}`;
    const body =
      action.kind === 'retry' ? { note: note.trim() } : { note: note.trim(), resolution };
    setPending(true);
    setError('');
    try {
      const response = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = (await response.json().catch(() => null)) as unknown;
      if (!response.ok) throw new Error(errorMessage(response.status));
      const next = parseNotificationOutboxSnapshot(payload);
      if (!next) throw new Error('پاسخ سرویس Notification Outbox معتبر نیست.');
      setData(next);
      setAction(null);
      setSuccess(
        action.kind === 'retry' || resolution === 'RETRY_APPROVED'
          ? 'پیام برای تلاش مجدد آزاد شد.'
          : 'پیام با تأیید اپراتور ارسال‌شده ثبت شد.',
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'عملیات بازیابی انجام نشد.');
    } finally {
      setPending(false);
    }
  }

  if (failed || !data)
    return (
      <Alert tone="danger" title="اطلاعات Notification Outbox دریافت نشد">
        اتصال API و مجوز `orders.read` را بررسی و صفحه را تازه‌سازی کنید.
      </Alert>
    );

  const columns: readonly DataTableColumn<NotificationOutboxItem>[] = [
    {
      id: 'event',
      header: 'رویداد',
      cell: (item) => (
        <div>
          <p className="font-bold">{eventLabel(item)}</p>
          <div className="mt-1">
            <SourceBadge source={item.source} />
          </div>
        </div>
      ),
    },
    { id: 'status', header: 'وضعیت', cell: (item) => <StatusBadge status={item.status} /> },
    { id: 'attempts', header: 'تلاش', cell: (item) => formatAdminInteger(item.attempts) },
    {
      id: 'updated',
      header: 'آخرین تغییر',
      visibility: 'lg',
      cell: (item) => formatAdminDateTime(item.updatedAt),
    },
    {
      id: 'error',
      header: 'آخرین خطا',
      visibility: 'lg',
      cell: (item) => (
        <span className="line-clamp-2 max-w-72 text-xs">{item.lastError ?? 'بدون خطا'}</span>
      ),
    },
    {
      id: 'actions',
      header: 'عملیات',
      align: 'end',
      cell: (item) => (
        <Button size="sm" variant="outline" onClick={() => openDetails(item, 'desktop')}>
          جزئیات
        </Button>
      ),
    },
  ];
  const activeFilters =
    Number(Boolean(needle)) + Number(source !== 'all') + Number(status !== 'all');
  const detailFooter =
    selected && canRecover && (selected.status === 'FAILED' || selected.status === 'UNKNOWN') ? (
      <Button
        variant={selected.status === 'UNKNOWN' ? 'danger' : 'primary'}
        onClick={() =>
          openAction({ kind: selected.status === 'FAILED' ? 'retry' : 'resolve', item: selected })
        }
      >
        {selected.status === 'FAILED' ? 'تلاش مجدد' : 'تعیین تکلیف نتیجه'}
      </Button>
    ) : undefined;

  return (
    <div className="space-y-6">
      {success ? <Alert tone="success">{success}</Alert> : null}
      {!canRecover ? (
        <Alert tone="info">
          دسترسی شما فقط برای مشاهده است؛ retry و recovery به `orders.status.write` نیاز دارد.
        </Alert>
      ) : null}
      {data.summary.unknown ? (
        <Alert tone="warning" title="ارسال‌های نامشخص نیازمند بررسی ارائه‌دهنده هستند">
          قبل از retry وضعیت پیام را در پنل ارائه‌دهنده بررسی کنید تا ارسال تکراری رخ ندهد.
        </Alert>
      ) : null}
      <section aria-label="شاخص‌های صف ارسال" className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi label="کل پیام‌ها" value={data.summary.total} tone="neutral" />
        <Kpi label="در انتظار" value={data.summary.pending} tone="info" />
        <Kpi
          label="ناموفق"
          value={data.summary.failed}
          tone={data.summary.failed ? 'danger' : 'neutral'}
        />
        <Kpi
          label="نامشخص"
          value={data.summary.unknown}
          tone={data.summary.unknown ? 'warning' : 'neutral'}
        />
        <Kpi label="ارسال‌شده" value={data.summary.sent} tone="success" />
      </section>
      <Card
        title="سلامت چرخه ارسال"
        description={`آخرین دریافت: ${formatAdminDateTime(data.generatedAt)}`}
      >
        <DonutChart
          title="وضعیت Notification Outbox"
          segments={[
            {
              label: 'در انتظار',
              value: data.summary.pending,
              color: 'var(--admin-color-primary)',
            },
            {
              label: 'درحال پردازش',
              value: data.summary.processing + data.summary.dispatching,
              color: 'var(--admin-color-warning)',
            },
            {
              label: 'ناموفق یا نامشخص',
              value: data.summary.failed + data.summary.unknown,
              color: 'var(--admin-color-danger)',
            },
            { label: 'ارسال‌شده', value: data.summary.sent, color: 'var(--admin-color-success)' },
          ]}
        />
      </Card>
      <FilterBar
        activeCount={activeFilters}
        resetAction={
          activeFilters ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setSearch('');
                setSource('all');
                setStatus('all');
              }}
            >
              بازنشانی فیلترها
            </Button>
          ) : undefined
        }
      >
        <SearchField
          aria-label="جستجوی پیام"
          placeholder="رویداد، شناسه یا خطا"
          value={search}
          onChange={(event) => setSearch(toPersianDigits(event.target.value))}
        />
        <Select
          aria-label="فیلتر منبع پیام"
          value={source}
          onValueChange={(value) => setSource(value as SourceFilter)}
          options={[
            { value: 'all', label: 'همه منابع' },
            { value: 'CUSTOMER', label: 'پیام مشتری' },
            { value: 'OPERATIONAL', label: 'هشدار عملیاتی' },
          ]}
        />
        <Select
          aria-label="فیلتر وضعیت پیام"
          value={status}
          onValueChange={(value) => setStatus(value as StatusFilter)}
          options={[
            { value: 'all', label: 'همه وضعیت‌ها' },
            ...Object.entries(STATUS).map(([value, meta]) => ({ value, label: meta.label })),
          ]}
        />
      </FilterBar>
      <ResponsiveDataView
        caption="فهرست Notification Outbox"
        mobileLabel="کارت‌های صف ارسال"
        columns={columns}
        rows={filtered}
        getRowKey={(item) => `${item.source}-${item.id}`}
        emptyTitle="پیامی پیدا نشد"
        emptyDescription="فیلتر یا عبارت جستجو را تغییر دهید."
        renderMobileCard={(item) => (
          <MobileDataCard
            detailsOpen={detailMode === 'mobile' && selected?.id === item.id}
            onDetailsOpenChange={(open) => (open ? openDetails(item, 'mobile') : closeDetails())}
            title={eventLabel(item)}
            eyebrow={<SourceBadge source={item.source} />}
            status={<StatusBadge status={item.status} />}
            items={[
              { label: 'تلاش', value: formatAdminInteger(item.attempts) },
              { label: 'آخرین تغییر', value: formatAdminDateTime(item.updatedAt) },
              { label: 'مرجع', value: item.aggregateType },
              { label: 'خطا', value: item.lastError ?? 'ندارد' },
            ]}
            detailsTitle={eventLabel(item)}
            detailsDescription={STATUS[item.status].label}
            details={<OutboxDetails item={item} />}
            detailsFooter={detailFooter}
          />
        )}
      />
      <Dialog open={detailMode === 'desktop'} onOpenChange={(open) => !open && closeDetails()}>
        {selected ? (
          <DialogContent
            size="lg"
            title={eventLabel(selected)}
            description={STATUS[selected.status].label}
            footer={detailFooter}
          >
            <OutboxDetails item={selected} />
          </DialogContent>
        ) : null}
      </Dialog>
      <Dialog open={action !== null} onOpenChange={(open) => !open && closeAction()}>
        {action ? (
          <DialogContent
            title={action.kind === 'retry' ? 'تلاش مجدد ارسال' : 'تعیین تکلیف ارسال نامشخص'}
            description={eventLabel(action.item)}
            hideClose={pending}
            footer={
              <>
                <Button variant="outline" disabled={pending} onClick={closeAction}>
                  انصراف
                </Button>
                <Button
                  type="submit"
                  form="notification-outbox-action"
                  variant={
                    action.kind === 'resolve' && resolution === 'MARKED_SENT' ? 'danger' : 'primary'
                  }
                  loading={pending}
                >
                  ثبت اقدام
                </Button>
              </>
            }
          >
            <form id="notification-outbox-action" className="space-y-4" onSubmit={submit}>
              {action.kind === 'resolve' ? (
                <>
                  <Alert tone="warning">
                    این تصمیم باید پس از بررسی نتیجه در پنل ارائه‌دهنده ثبت شود.
                  </Alert>
                  <Select
                    aria-label="تصمیم recovery"
                    value={resolution}
                    onValueChange={(value) =>
                      setResolution(value as NotificationRecoveryResolution)
                    }
                    options={[
                      { value: 'RETRY_APPROVED', label: 'ارسال نشده؛ اجازه تلاش مجدد' },
                      { value: 'MARKED_SENT', label: 'ارسال شده؛ ثبت نهایی بدون ارسال مجدد' },
                    ]}
                  />
                </>
              ) : (
                <Alert tone="info">
                  این خطا پیش از مرز ارسال قطعی رخ داده و پیام دوباره وارد صف می‌شود.
                </Alert>
              )}
              <label className="block text-sm font-semibold" htmlFor="outbox-note">
                یادداشت اقدام
              </label>
              <Textarea
                id="outbox-note"
                required
                minLength={3}
                maxLength={1000}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="نتیجه بررسی یا دلیل retry را ثبت کنید"
                disabled={pending}
              />
              {error ? <Alert tone="danger">{error}</Alert> : null}
            </form>
          </DialogContent>
        ) : null}
      </Dialog>
    </div>
  );
}
