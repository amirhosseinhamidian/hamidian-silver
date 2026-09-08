'use client';

import { useMemo, useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { DataTableColumn } from '@/components/ui/data-table';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { FilterBar, SearchField } from '@/components/ui/filter-bar';
import { MobileDataCard } from '@/components/ui/mobile-data-card';
import { ResponsiveDataView } from '@/components/ui/responsive-data-view';
import { Select } from '@/components/ui/select';
import {
  formatFulfillmentAge,
  fulfillmentWorkDestination,
  type AdminFulfillmentPriority,
  type AdminFulfillmentQueue,
  type AdminFulfillmentSummary,
  type AdminFulfillmentWorkCode,
  type AdminFulfillmentWorkItem,
  type AdminFulfillmentWorkState,
  type AdminFulfillmentWorkType,
} from '@/lib/fulfillment/fulfillment-model';
import {
  formatAdminDateTime,
  formatAdminInteger,
  toAsciiDigits,
  toPersianDigits,
} from '@/lib/presentation/formatters';

type Props = Readonly<{
  queue: AdminFulfillmentQueue | null;
  summary: AdminFulfillmentSummary | null;
  failed: boolean;
}>;

type TypeFilter = 'all' | AdminFulfillmentWorkType;
type StateFilter = 'all' | AdminFulfillmentWorkState;
type PriorityFilter = 'all' | AdminFulfillmentPriority;

const STATE: Record<AdminFulfillmentWorkState, { label: string; tone: BadgeTone }> = {
  READY: { label: 'آماده اقدام', tone: 'success' },
  BLOCKED: { label: 'مسدود', tone: 'warning' },
  OVERDUE: { label: 'معوق', tone: 'danger' },
};

const PRIORITY: Record<AdminFulfillmentPriority, { label: string; tone: BadgeTone }> = {
  CRITICAL: { label: 'بحرانی', tone: 'danger' },
  HIGH: { label: 'بالا', tone: 'danger' },
  MEDIUM: { label: 'متوسط', tone: 'warning' },
  NORMAL: { label: 'عادی', tone: 'neutral' },
};

const WORK_CODE: Record<AdminFulfillmentWorkCode, { label: string; description: string }> = {
  PLATING_NOT_STARTED: {
    label: 'آبکاری شروع نشده',
    description: 'سفارش تا شروع عملیات آبکاری امکان عبور از گیت ارسال را ندارد.',
  },
  PLATING_IN_PROGRESS: {
    label: 'آبکاری در حال انجام',
    description: 'تکمیل و ثبت هزینه واقعی آبکاری برای آزادشدن گیت ارسال لازم است.',
  },
  PLATING_OVERDUE: {
    label: 'آبکاری از SLA عبور کرده',
    description: 'عملیات آبکاری معوق است و باید با اولویت بالا پیگیری شود.',
  },
  PLATING_CANCELLED: {
    label: 'آبکاری لغو شده',
    description: 'لغو آبکاری مسیر آماده‌سازی را مسدود کرده و نیازمند تصمیم عملیاتی است.',
  },
  SHIPPING_NOT_SELECTED: {
    label: 'روش ارسال انتخاب نشده',
    description: 'برای سفارش هنوز مرسوله یا روش ارسال ثبت نشده است.',
  },
  READY_FOR_SHIPMENT_CREATION: {
    label: 'آماده ساخت مرسوله',
    description: 'پرداخت و پیش‌نیازها تأیید شده‌اند و مرسوله می‌تواند ساخته شود.',
  },
  SHIPMENT_CREATION_IN_PROGRESS: {
    label: 'ساخت مرسوله در حال انجام',
    description: 'درخواست ساخت مرسوله هنوز به نتیجه قطعی نرسیده است.',
  },
  SHIPMENT_CREATION_STALE: {
    label: 'ساخت مرسوله متوقف مانده',
    description: 'زمان انتظار ساخت مرسوله از محدوده امن عبور کرده است.',
  },
  SHIPMENT_PROVIDER_RECONCILIATION_REQUIRED: {
    label: 'نیازمند تطبیق وضعیت مرسوله',
    description: 'وضعیت داخلی و اطلاعات مرجع ارسال سازگار نیست و باید بررسی شود.',
  },
  READY_FOR_HANDOFF: {
    label: 'آماده تحویل به پست',
    description: 'همه گیت‌ها عبور کرده‌اند و مرسوله آماده تحویل به شرکت حمل است.',
  },
};

const TYPE_OPTIONS = [
  { value: 'all', label: 'همه واحدها' },
  { value: 'SHIPPING', label: 'ارسال و مرسوله' },
  { value: 'PLATING', label: 'مانع آبکاری' },
];

const STATE_OPTIONS = [
  { value: 'all', label: 'همه وضعیت‌ها' },
  { value: 'READY', label: 'آماده اقدام' },
  { value: 'BLOCKED', label: 'مسدود' },
  { value: 'OVERDUE', label: 'معوق' },
];

const PRIORITY_OPTIONS = [
  { value: 'all', label: 'همه اولویت‌ها' },
  { value: 'CRITICAL', label: 'بحرانی' },
  { value: 'HIGH', label: 'بالا' },
  { value: 'MEDIUM', label: 'متوسط' },
  { value: 'NORMAL', label: 'عادی' },
];

function StateBadge({ state }: Readonly<{ state: AdminFulfillmentWorkState }>) {
  const item = STATE[state];
  return (
    <Badge tone={item.tone} dot>
      {item.label}
    </Badge>
  );
}

function PriorityBadge({ priority }: Readonly<{ priority: AdminFulfillmentPriority }>) {
  const item = PRIORITY[priority];
  return <Badge tone={item.tone}>{item.label}</Badge>;
}

function Kpi({
  label,
  value,
  description,
  tone = 'neutral',
}: Readonly<{ label: string; value: number; description: string; tone?: BadgeTone }>) {
  const color =
    tone === 'danger'
      ? 'text-[var(--admin-color-danger)]'
      : tone === 'warning'
        ? 'text-[var(--admin-color-warning)]'
        : tone === 'success'
          ? 'text-[var(--admin-color-success)]'
          : '';
  return (
    <Card>
      <p className="text-xs text-[var(--admin-color-muted)]">{label}</p>
      <p className={`mt-2 text-2xl font-black ${color}`}>{formatAdminInteger(value)}</p>
      <p className="mt-1 text-[0.6875rem] text-[var(--admin-color-subtle)]">{description}</p>
    </Card>
  );
}

function QueueChart({ summary }: Readonly<{ summary: AdminFulfillmentSummary | null }>) {
  const values = summary
    ? [
        { key: 'ready', label: 'آماده', value: summary.ready, color: 'bg-emerald-500' },
        { key: 'blocked', label: 'مسدود', value: summary.blocked, color: 'bg-amber-400' },
        { key: 'overdue', label: 'معوق', value: summary.overdue, color: 'bg-red-500' },
      ]
    : [];
  const total = values.reduce((sum, item) => sum + item.value, 0);
  return (
    <Card title="وضعیت جریان آماده‌سازی" description="توزیع لحظه‌ای کارهای آماده، مسدود و معوق">
      {total ? (
        <>
          <div
            role="img"
            aria-label="نمودار وضعیت صف آماده‌سازی"
            className="flex h-3 overflow-hidden rounded-full bg-[var(--admin-color-surface-subtle)]"
          >
            {values.map((item) =>
              item.value ? (
                <span
                  key={item.key}
                  className={item.color}
                  style={{ width: `${(item.value / total) * 100}%` }}
                />
              ) : null,
            )}
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {values.map((item) => (
              <div key={item.key} className="text-center">
                <span className={`mx-auto block size-2 rounded-full ${item.color}`} />
                <p className="mt-1 text-xs text-[var(--admin-color-muted)]">{item.label}</p>
                <p className="mt-0.5 text-sm font-black">{formatAdminInteger(item.value)}</p>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="text-sm text-[var(--admin-color-muted)]">اطلاعات نمودار در دسترس نیست.</p>
      )}
    </Card>
  );
}

function BottleneckSummary({ summary }: Readonly<{ summary: AdminFulfillmentSummary | null }>) {
  const items = summary
    ? [
        { label: 'آبکاری شروع‌نشده', value: summary.platingPending },
        { label: 'آبکاری در حال انجام', value: summary.platingInProgress },
        { label: 'بدون روش ارسال', value: summary.shippingNotSelected },
        { label: 'آماده ساخت مرسوله', value: summary.shipmentReady },
        { label: 'آماده تحویل', value: summary.shipmentReadyForHandoff },
        { label: 'ساخت مرسوله متوقف', value: summary.shipmentStale },
      ]
    : [];
  return (
    <Card title="گلوگاه‌های عملیاتی" description="محل فعلی توقف یا آمادگی سفارش‌ها">
      {items.length ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {items.map((item) => (
            <div
              key={item.label}
              className="rounded-[var(--admin-radius-md)] bg-[var(--admin-color-surface-subtle)] p-3"
            >
              <p className="text-[0.6875rem] text-[var(--admin-color-muted)]">{item.label}</p>
              <p className="mt-1 text-lg font-black">{formatAdminInteger(item.value)}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-[var(--admin-color-muted)]">اطلاعات گلوگاه‌ها دریافت نشد.</p>
      )}
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

function destinationLabel(item: AdminFulfillmentWorkItem): string {
  if (item.workType === 'PLATING') return 'رفتن به صف آبکاری';
  if (item.code === 'READY_FOR_HANDOFF') return 'ثبت تحویل مرسوله';
  return 'رفتن به مدیریت ارسال';
}

function ItemActions({ item }: Readonly<{ item: AdminFulfillmentWorkItem }>) {
  return (
    <div className="flex flex-wrap justify-end gap-2">
      <ButtonLink href={fulfillmentWorkDestination(item)} size="sm">
        {destinationLabel(item)}
      </ButtonLink>
      <ButtonLink href="/orders" variant="outline" size="sm">
        مشاهده سفارش
      </ButtonLink>
    </div>
  );
}

function WorkItemDetails({ item }: Readonly<{ item: AdminFulfillmentWorkItem }>) {
  const contextRows: Array<readonly [string, string]> = [];
  if (item.context.phase) contextRows.push(['مرحله', item.context.phase]);
  if (item.context.maxLeadTimeDays !== null)
    contextRows.push(['زمان آبکاری', `${item.context.maxLeadTimeDays} روز`]);
  if (item.context.provider) contextRows.push(['سرویس ارسال', item.context.provider]);
  if (item.context.providerCreationState)
    contextRows.push(['وضعیت ساخت مرسوله', item.context.providerCreationState]);
  if (item.context.providerShipmentId)
    contextRows.push(['شناسه مرسوله', item.context.providerShipmentId]);
  if (item.context.providerCreateError)
    contextRows.push(['خطای سرویس ارسال', item.context.providerCreateError]);
  if (item.context.reason) contextRows.push(['دلیل فنی', item.context.reason]);
  if (item.context.incidentAt)
    contextRows.push(['زمان رخداد', formatAdminDateTime(item.context.incidentAt)]);

  return (
    <div className="space-y-4">
      <Alert tone={STATE[item.state].tone} title={WORK_CODE[item.code].label}>
        {WORK_CODE[item.code].description}
      </Alert>
      <Card title="اطلاعات صف">
        <DetailRows
          rows={[
            ['شماره سفارش', item.orderNumber],
            ['وضعیت سفارش', item.orderStatus],
            ['واحد مسئول', item.workType === 'PLATING' ? 'آبکاری' : 'ارسال'],
            ['وضعیت صف', STATE[item.state].label],
            ['اولویت', PRIORITY[item.priority].label],
            ['مدت حضور در صف', formatFulfillmentAge(item.ageMinutes)],
            ['مهلت اقدام', item.dueAt ? formatAdminDateTime(item.dueAt) : 'بدون مهلت مشخص'],
          ]}
        />
      </Card>
      {contextRows.length ? (
        <Card title="اطلاعات فنی گیت">
          <DetailRows rows={contextRows} />
        </Card>
      ) : null}
    </div>
  );
}

export function FulfillmentManagementView({ queue, summary, failed }: Props) {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [stateFilter, setStateFilter] = useState<StateFilter>('all');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');
  const [detailsItem, setDetailsItem] = useState<AdminFulfillmentWorkItem | null>(null);
  const [mobileDetailsKey, setMobileDetailsKey] = useState<string | null>(null);
  const items = useMemo(() => queue?.items ?? [], [queue]);
  const needle = toAsciiDigits(search).trim().toLocaleLowerCase('fa');
  const filtered = useMemo(
    () =>
      items.filter((item) => {
        if (typeFilter !== 'all' && item.workType !== typeFilter) return false;
        if (stateFilter !== 'all' && item.state !== stateFilter) return false;
        if (priorityFilter !== 'all' && item.priority !== priorityFilter) return false;
        if (!needle) return true;
        return [
          item.orderNumber,
          WORK_CODE[item.code].label,
          item.context.provider ?? '',
          item.context.providerShipmentId ?? '',
          item.context.providerCreateError ?? '',
        ].some((value) => toAsciiDigits(value).toLocaleLowerCase('fa').includes(needle));
      }),
    [items, needle, priorityFilter, stateFilter, typeFilter],
  );

  const columns: readonly DataTableColumn<AdminFulfillmentWorkItem>[] = [
    {
      id: 'order',
      header: 'سفارش',
      cell: (item) => (
        <div>
          <p className="font-bold" dir="ltr">
            {toPersianDigits(item.orderNumber)}
          </p>
          <p className="mt-1 text-xs text-[var(--admin-color-muted)]">
            {item.workType === 'PLATING' ? 'واحد آبکاری' : 'واحد ارسال'}
          </p>
        </div>
      ),
    },
    {
      id: 'task',
      header: 'اقدام موردنیاز',
      cell: (item) => (
        <div className="max-w-64">
          <p className="font-semibold">{WORK_CODE[item.code].label}</p>
          <p className="mt-1 truncate text-xs text-[var(--admin-color-muted)]">
            {WORK_CODE[item.code].description}
          </p>
        </div>
      ),
    },
    { id: 'state', header: 'وضعیت', cell: (item) => <StateBadge state={item.state} /> },
    {
      id: 'priority',
      header: 'اولویت',
      cell: (item) => <PriorityBadge priority={item.priority} />,
    },
    {
      id: 'age',
      header: 'زمان انتظار',
      visibility: 'lg',
      cell: (item) => toPersianDigits(formatFulfillmentAge(item.ageMinutes)),
    },
    {
      id: 'actions',
      header: 'عملیات',
      align: 'end',
      cell: (item) => (
        <div className="flex flex-wrap justify-end gap-2">
          <Button size="sm" variant="outline" onClick={() => setDetailsItem(item)}>
            جزئیات گیت
          </Button>
          <ButtonLink href={fulfillmentWorkDestination(item)} size="sm">
            اقدام
          </ButtonLink>
        </div>
      ),
    },
  ];

  const activeFilterCount =
    Number(Boolean(needle)) +
    Number(typeFilter !== 'all') +
    Number(stateFilter !== 'all') +
    Number(priorityFilter !== 'all');

  return (
    <div className="space-y-6">
      {failed ? (
        <Alert tone="danger" title="بخشی از صف آماده‌سازی دریافت نشد">
          اطلاعات نمایش‌داده‌شده ممکن است کامل نباشد؛ اتصال API را بررسی و صفحه را تازه‌سازی کنید.
        </Alert>
      ) : null}
      {summary?.reconciliationRequired ? (
        <Alert
          tone="danger"
          title={`${formatAdminInteger(summary.reconciliationRequired)} مرسوله نیازمند تطبیق فوری`}
          action={
            <ButtonLink href="/shipping" variant="danger" size="sm">
              بررسی ارسال
            </ButtonLink>
          }
        >
          وضعیت ساخت یا شناسه مرسوله ناسازگار است؛ پیش از هر تلاش مجدد آن را بررسی کنید.
        </Alert>
      ) : null}

      <section aria-label="شاخص‌های آماده‌سازی" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="سفارش در صف" value={summary?.uniqueOrderCount ?? 0} description="سفارش یکتا" />
        <Kpi
          label="آماده اقدام"
          value={summary?.ready ?? 0}
          tone="success"
          description="قابل پیشروی فوری"
        />
        <Kpi
          label="مسدود"
          value={summary?.blocked ?? 0}
          tone={summary?.blocked ? 'warning' : 'neutral'}
          description="نیازمند رفع پیش‌شرط"
        />
        <Kpi
          label="معوق"
          value={summary?.overdue ?? 0}
          tone={summary?.overdue ? 'danger' : 'success'}
          description="نیازمند رسیدگی فوری"
        />
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <QueueChart summary={summary} />
        <BottleneckSummary summary={summary} />
      </section>

      <FilterBar
        activeCount={activeFilterCount}
        resetAction={
          activeFilterCount ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setSearch('');
                setTypeFilter('all');
                setStateFilter('all');
                setPriorityFilter('all');
              }}
            >
              پاک‌کردن فیلترها
            </Button>
          ) : undefined
        }
      >
        <SearchField
          aria-label="جستجوی صف آماده‌سازی"
          value={search}
          placeholder="شماره سفارش، اقدام، مرجع یا خطای ارسال"
          onChange={(event) => setSearch(toPersianDigits(event.target.value))}
        />
        <Select
          aria-label="فیلتر واحد مسئول"
          value={typeFilter}
          options={TYPE_OPTIONS}
          onValueChange={(value) => setTypeFilter(value as TypeFilter)}
        />
        <Select
          aria-label="فیلتر وضعیت گیت"
          value={stateFilter}
          options={STATE_OPTIONS}
          onValueChange={(value) => setStateFilter(value as StateFilter)}
        />
        <Select
          aria-label="فیلتر اولویت"
          value={priorityFilter}
          options={PRIORITY_OPTIONS}
          onValueChange={(value) => setPriorityFilter(value as PriorityFilter)}
        />
      </FilterBar>

      {queue ? (
        <p className="text-xs text-[var(--admin-color-subtle)]">
          آخرین محاسبه گیت‌ها: {formatAdminDateTime(queue.generatedAt)} · نمایش{' '}
          {formatAdminInteger(queue.count)} از {formatAdminInteger(queue.totalMatched)} مورد
        </p>
      ) : null}

      <ResponsiveDataView
        caption="صف آماده‌سازی و گیت ارسال"
        mobileLabel="کارت‌های صف آماده‌سازی"
        columns={columns}
        rows={filtered}
        getRowKey={(item) => `${item.orderId}-${item.code}`}
        getRowClassName={(item) =>
          item.state === 'OVERDUE' ? 'bg-[var(--admin-color-danger-soft)]/30' : undefined
        }
        emptyTitle={activeFilterCount ? 'نتیجه‌ای پیدا نشد' : 'صف آماده‌سازی خالی است'}
        emptyDescription="در حال حاضر اقدامی برای آماده‌سازی یا تحویل مرسوله باقی نمانده است."
        renderMobileCard={(item) => {
          const key = `${item.orderId}-${item.code}`;
          return (
            <MobileDataCard
              detailsOpen={mobileDetailsKey === key}
              onDetailsOpenChange={(open) => setMobileDetailsKey(open ? key : null)}
              title={WORK_CODE[item.code].label}
              eyebrow={toPersianDigits(item.orderNumber)}
              status={<StateBadge state={item.state} />}
              items={[
                { label: 'واحد', value: item.workType === 'PLATING' ? 'آبکاری' : 'ارسال' },
                { label: 'اولویت', value: PRIORITY[item.priority].label },
                {
                  label: 'زمان انتظار',
                  value: toPersianDigits(formatFulfillmentAge(item.ageMinutes)),
                },
                {
                  label: 'مهلت اقدام',
                  value: item.dueAt ? formatAdminDateTime(item.dueAt) : 'بدون مهلت',
                },
              ]}
              detailsTitle={`گیت سفارش ${toPersianDigits(item.orderNumber)}`}
              detailsDescription={WORK_CODE[item.code].label}
              details={<WorkItemDetails item={item} />}
              detailsFooter={<ItemActions item={item} />}
            />
          );
        }}
      />

      <Dialog
        open={detailsItem !== null}
        onOpenChange={(open) => {
          if (!open) setDetailsItem(null);
        }}
      >
        <DialogContent
          size="lg"
          title={
            detailsItem ? `گیت سفارش ${toPersianDigits(detailsItem.orderNumber)}` : 'جزئیات گیت'
          }
          description={detailsItem ? WORK_CODE[detailsItem.code].label : undefined}
          footer={detailsItem ? <ItemActions item={detailsItem} /> : undefined}
        >
          {detailsItem ? <WorkItemDetails item={detailsItem} /> : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
