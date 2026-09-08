'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState, type FormEvent } from 'react';

import { Alert } from '@/components/ui/alert';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { BottomSheet, BottomSheetContent } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { DataTableColumn } from '@/components/ui/data-table';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { FilterBar, SearchField } from '@/components/ui/filter-bar';
import { Input, Textarea } from '@/components/ui/form-control';
import { FormField } from '@/components/ui/form-field';
import { MobileDataCard } from '@/components/ui/mobile-data-card';
import { ResponsiveDataView } from '@/components/ui/responsive-data-view';
import { Select } from '@/components/ui/select';
import {
  getPlatingSla,
  platingActorLabel,
  type AdminPlatingFulfillmentStatus,
  type AdminPlatingOrder,
  type AdminPlatingSla,
  type AdminPlatingSlaState,
} from '@/lib/plating-operations/plating-operations-model';
import {
  formatAdminDateTime,
  formatAdminInteger,
  formatAdminPhone,
  formatAdminToman,
  toAsciiDigits,
  toPersianDigits,
} from '@/lib/presentation/formatters';

type Props = Readonly<{
  orders: readonly AdminPlatingOrder[];
  failed: boolean;
  canOperate: boolean;
  canComplete: boolean;
}>;

type StatusFilter = 'all' | AdminPlatingFulfillmentStatus;
type SlaFilter = 'all' | 'attention' | 'overdue';
type Operation =
  | Readonly<{ kind: 'start'; order: AdminPlatingOrder }>
  | Readonly<{ kind: 'complete'; order: AdminPlatingOrder }>
  | Readonly<{ kind: 'cancel'; order: AdminPlatingOrder }>;

const STATUS: Record<AdminPlatingFulfillmentStatus, { label: string; tone: BadgeTone }> = {
  PENDING: { label: 'در انتظار شروع', tone: 'warning' },
  IN_PROGRESS: { label: 'در حال آبکاری', tone: 'info' },
  COMPLETED: { label: 'تکمیل‌شده', tone: 'success' },
  CANCELLED: { label: 'لغوشده', tone: 'neutral' },
};

const SLA: Record<AdminPlatingSlaState, { label: string; tone: BadgeTone }> = {
  ON_TRACK: { label: 'در محدوده SLA', tone: 'success' },
  DUE_SOON: { label: 'نزدیک سررسید', tone: 'warning' },
  OVERDUE: { label: 'عبور از SLA', tone: 'danger' },
  ON_TIME: { label: 'به‌موقع تکمیل شد', tone: 'success' },
  LATE: { label: 'با تأخیر تکمیل شد', tone: 'danger' },
  NONE: { label: 'بدون SLA', tone: 'neutral' },
};

const STATUS_OPTIONS = [
  { value: 'all', label: 'همه وضعیت‌ها' },
  ...Object.entries(STATUS).map(([value, item]) => ({ value, label: item.label })),
];

const SLA_OPTIONS = [
  { value: 'all', label: 'همه وضعیت‌های SLA' },
  { value: 'attention', label: 'نیازمند توجه' },
  { value: 'overdue', label: 'فقط عبور از SLA' },
];

const decimalFormatter = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 3 });

function StatusBadge({ status }: Readonly<{ status: AdminPlatingFulfillmentStatus }>) {
  const item = STATUS[status];
  return (
    <Badge tone={item.tone} dot>
      {item.label}
    </Badge>
  );
}

function SlaBadge({ sla }: Readonly<{ sla: AdminPlatingSla }>) {
  const item = SLA[sla.state];
  return (
    <div>
      <Badge tone={item.tone} dot>
        {item.label}
      </Badge>
      {sla.deadline ? (
        <p className="mt-1 text-[0.6875rem] text-[var(--admin-color-subtle)]">
          سررسید {formatAdminDateTime(sla.deadline)}
        </p>
      ) : null}
    </div>
  );
}

function Kpi({
  label,
  value,
  tone = 'neutral',
  description,
}: Readonly<{ label: string; value: number; tone?: BadgeTone; description: string }>) {
  const color =
    tone === 'danger'
      ? 'text-[var(--admin-color-danger)]'
      : tone === 'warning'
        ? 'text-[var(--admin-color-warning)]'
        : tone === 'success'
          ? 'text-[var(--admin-color-success)]'
          : tone === 'info'
            ? 'text-[var(--admin-color-info)]'
            : '';
  return (
    <Card>
      <p className="text-xs text-[var(--admin-color-muted)]">{label}</p>
      <p className={`mt-2 text-2xl font-black ${color}`}>{formatAdminInteger(value)}</p>
      <p className="mt-1 text-[0.6875rem] text-[var(--admin-color-subtle)]">{description}</p>
    </Card>
  );
}

function WorkloadChart({
  counts,
}: Readonly<{ counts: Record<AdminPlatingFulfillmentStatus, number> }>) {
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
  const segments = [
    { status: 'PENDING' as const, color: 'bg-amber-400' },
    { status: 'IN_PROGRESS' as const, color: 'bg-blue-500' },
    { status: 'COMPLETED' as const, color: 'bg-emerald-500' },
    { status: 'CANCELLED' as const, color: 'bg-slate-300' },
  ];
  return (
    <Card
      title="ترکیب صف آبکاری"
      description="نمای سریع توزیع وضعیت سفارش‌های دریافت‌شده"
      className="lg:col-span-2"
    >
      {total ? (
        <>
          <div
            role="img"
            aria-label="نمودار توزیع وضعیت صف آبکاری"
            className="flex h-3 overflow-hidden rounded-full bg-[var(--admin-color-surface-subtle)]"
          >
            {segments.map((segment) =>
              counts[segment.status] ? (
                <span
                  key={segment.status}
                  className={segment.color}
                  style={{ width: `${(counts[segment.status] / total) * 100}%` }}
                />
              ) : null,
            )}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {segments.map((segment) => (
              <div key={segment.status} className="flex items-center gap-2 text-xs">
                <span className={`size-2 rounded-full ${segment.color}`} />
                <span className="text-[var(--admin-color-muted)]">
                  {STATUS[segment.status].label}
                </span>
                <strong className="me-auto">{formatAdminInteger(counts[segment.status])}</strong>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="text-sm text-[var(--admin-color-muted)]">صف آبکاری خالی است.</p>
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

function actorDetails(actor: Parameters<typeof platingActorLabel>[0]) {
  if (!actor) return 'ثبت نشده';
  const label = platingActorLabel(actor);
  return label === actor.phone ? formatAdminPhone(actor.phone) : label;
}

function OrderDetails({
  order,
  sla,
}: Readonly<{ order: AdminPlatingOrder; sla: AdminPlatingSla }>) {
  const fulfillment = order.fulfillment;
  const totalWeight = order.items.reduce(
    (sum, item) => sum + (item.platingWeightGrams ?? 0) * item.quantity,
    0,
  );
  return (
    <div className="space-y-4">
      <Card title="خلاصه عملیات">
        <DetailRows
          rows={[
            ['شماره سفارش', order.orderNumber],
            ['وضعیت سفارش', order.orderStatus],
            ['زمان پرداخت', order.paidAt ? formatAdminDateTime(order.paidAt) : 'ثبت نشده'],
            ['مهلت سرویس', sla.deadline ? formatAdminDateTime(sla.deadline) : 'محاسبه نشده'],
            ['زمان برآوردی', sla.leadTimeDays === null ? 'ثبت نشده' : `${sla.leadTimeDays} روز`],
            ['وزن کل آبکاری', `${decimalFormatter.format(totalWeight)} گرم`],
            ['مبلغ آبکاری سفارش', formatAdminToman(order.platingTotalToman)],
            [
              'هزینه واقعی',
              fulfillment?.actualCostToman === null || fulfillment?.actualCostToman === undefined
                ? 'هنوز ثبت نشده'
                : formatAdminToman(fulfillment.actualCostToman),
            ],
            ['مرجع کارگاه', fulfillment?.externalReference ?? 'ثبت نشده'],
          ]}
        />
      </Card>
      <Card title="اقلام نیازمند آبکاری">
        <ul className="divide-y divide-[var(--admin-color-border)]">
          {order.items.map((item) => (
            <li key={item.id} className="py-3 first:pt-0 last:pb-0">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold">{item.productName}</p>
                  <p className="mt-1 text-xs text-[var(--admin-color-muted)]">
                    {item.variantName ?? 'بدون عنوان تنوع'} · SKU {toPersianDigits(item.sku)}
                  </p>
                </div>
                <Badge tone={item.platingType === 'GOLD' ? 'warning' : 'info'}>
                  {item.platingType === 'GOLD' ? 'طلا' : 'رودیوم'}
                </Badge>
              </div>
              <p className="mt-2 text-xs text-[var(--admin-color-muted)]">
                تعداد {formatAdminInteger(item.quantity)} · وزن واحد{' '}
                {item.platingWeightGrams === null
                  ? 'ثبت نشده'
                  : `${decimalFormatter.format(item.platingWeightGrams)} گرم`}
              </p>
            </li>
          ))}
        </ul>
      </Card>
      <Card title="سوابق ثبت‌شده">
        {fulfillment ? (
          <DetailRows
            rows={[
              ['شروع توسط', actorDetails(fulfillment.startedBy)],
              [
                'زمان شروع',
                fulfillment.startedAt ? formatAdminDateTime(fulfillment.startedAt) : 'ثبت نشده',
              ],
              ['یادداشت شروع', fulfillment.startNote ?? 'ثبت نشده'],
              ['تکمیل توسط', actorDetails(fulfillment.completedBy)],
              [
                'زمان تکمیل',
                fulfillment.completedAt ? formatAdminDateTime(fulfillment.completedAt) : 'ثبت نشده',
              ],
              ['یادداشت تکمیل', fulfillment.completionNote ?? 'ثبت نشده'],
              ['لغو توسط', actorDetails(fulfillment.cancelledBy)],
              ['دلیل لغو', fulfillment.cancellationReason ?? 'ثبت نشده'],
            ]}
          />
        ) : (
          <Alert tone="neutral">عملیات این سفارش هنوز شروع نشده است.</Alert>
        )}
      </Card>
    </div>
  );
}

function mutationError(status: number): string {
  if (status === 401) return 'نشست مدیریتی منقضی شده است. دوباره وارد شوید.';
  if (status === 403) return 'مجوز انجام این عملیات را ندارید.';
  if (status === 404) return 'سفارش یا عملیات آبکاری پیدا نشد.';
  if (status === 409) return 'وضعیت سفارش تغییر کرده است؛ صفحه را تازه‌سازی کنید.';
  if (status === 400 || status === 422)
    return 'اطلاعات معتبر نیست یا سفارش برای این عملیات آماده نشده است.';
  return 'عملیات آبکاری انجام نشد. دوباره تلاش کنید.';
}

function operationTitle(operation: Operation | null): string {
  if (operation?.kind === 'start') return 'شروع عملیات آبکاری';
  if (operation?.kind === 'complete') return 'تکمیل و ثبت هزینه واقعی';
  if (operation?.kind === 'cancel') return 'لغو عملیات آبکاری';
  return 'عملیات آبکاری';
}

export function PlatingOperationsView({ orders, failed, canOperate, canComplete }: Props) {
  const router = useRouter();
  const [now] = useState(() => Date.now());
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [slaFilter, setSlaFilter] = useState<SlaFilter>('all');
  const [detailsOrder, setDetailsOrder] = useState<AdminPlatingOrder | null>(null);
  const [mobileDetailsId, setMobileDetailsId] = useState<string | null>(null);
  const [operation, setOperation] = useState<Operation | null>(null);
  const [note, setNote] = useState('');
  const [actualCost, setActualCost] = useState('');
  const [externalReference, setExternalReference] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const needle = toAsciiDigits(search).trim().toLocaleLowerCase('fa');

  const rowsWithSla = useMemo(
    () =>
      orders
        .map((order) => ({ order, sla: getPlatingSla(order, now) }))
        .sort((left, right) => {
          const leftTime = left.sla.deadline ? new Date(left.sla.deadline).getTime() : Infinity;
          const rightTime = right.sla.deadline ? new Date(right.sla.deadline).getTime() : Infinity;
          return leftTime - rightTime;
        }),
    [now, orders],
  );

  const filtered = useMemo(
    () =>
      rowsWithSla.filter(({ order, sla }) => {
        if (statusFilter !== 'all' && order.fulfillmentStatus !== statusFilter) return false;
        if (slaFilter === 'overdue' && sla.state !== 'OVERDUE') return false;
        if (slaFilter === 'attention' && !['OVERDUE', 'DUE_SOON', 'LATE'].includes(sla.state))
          return false;
        if (!needle) return true;
        return [
          order.orderNumber,
          ...order.items.flatMap((item) => [item.productName, item.variantName ?? '', item.sku]),
          order.fulfillment?.externalReference ?? '',
        ].some((value) => toAsciiDigits(value).toLocaleLowerCase('fa').includes(needle));
      }),
    [needle, rowsWithSla, slaFilter, statusFilter],
  );

  const statusCounts = useMemo(
    () =>
      orders.reduce<Record<AdminPlatingFulfillmentStatus, number>>(
        (counts, order) => ({
          ...counts,
          [order.fulfillmentStatus]: counts[order.fulfillmentStatus] + 1,
        }),
        { PENDING: 0, IN_PROGRESS: 0, COMPLETED: 0, CANCELLED: 0 },
      ),
    [orders],
  );
  const overdueCount = rowsWithSla.filter(({ sla }) => sla.state === 'OVERDUE').length;
  const dueSoonCount = rowsWithSla.filter(({ sla }) => sla.state === 'DUE_SOON').length;

  function openOperation(nextOperation: Operation) {
    setMobileDetailsId(null);
    setOperation(nextOperation);
    setNote('');
    setActualCost('');
    setExternalReference('');
    setError('');
    setSuccess('');
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!operation || pending) return;
    const cleanNote = note.trim();
    if (cleanNote.length < 3) {
      setError(
        operation.kind === 'cancel'
          ? 'دلیل لغو باید حداقل ۳ نویسه باشد.'
          : 'یادداشت عملیات باید حداقل ۳ نویسه باشد.',
      );
      return;
    }
    let payload: Record<string, string | number>;
    if (operation.kind === 'complete') {
      const cost = Number(
        toAsciiDigits(actualCost)
          .replace(/[,٬\s]/g, '')
          .trim(),
      );
      if (!Number.isSafeInteger(cost) || cost < 0) {
        setError('هزینه واقعی را به‌صورت عدد صحیح و غیرمنفی وارد کنید.');
        return;
      }
      payload = {
        actualCostToman: cost,
        note: cleanNote,
        ...(externalReference.trim()
          ? { externalReference: toAsciiDigits(externalReference).trim() }
          : {}),
      };
    } else {
      payload = operation.kind === 'cancel' ? { reason: cleanNote } : { note: cleanNote };
    }
    setPending(true);
    setError('');
    try {
      const response = await fetch(
        `/api/plating-operations/orders/${encodeURIComponent(operation.order.orderId)}/${operation.kind}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );
      if (!response.ok) {
        setError(mutationError(response.status));
        return;
      }
      const completedKind = operation.kind;
      setOperation(null);
      setSuccess(
        completedKind === 'start'
          ? 'عملیات آبکاری شروع شد.'
          : completedKind === 'complete'
            ? 'آبکاری تکمیل و هزینه واقعی با موفقیت ثبت شد.'
            : 'عملیات آبکاری لغو شد.',
      );
      router.refresh();
    } catch {
      setError('ارتباط با سرور برقرار نشد. دوباره تلاش کنید.');
    } finally {
      setPending(false);
    }
  }

  function Actions({ order }: Readonly<{ order: AdminPlatingOrder }>) {
    if (order.fulfillmentStatus === 'PENDING') {
      return canOperate ? (
        <Button size="sm" onClick={() => openOperation({ kind: 'start', order })}>
          شروع آبکاری
        </Button>
      ) : (
        <span className="text-xs text-[var(--admin-color-muted)]">فقط مشاهده</span>
      );
    }
    if (order.fulfillmentStatus === 'IN_PROGRESS') {
      if (!canOperate && !canComplete)
        return <span className="text-xs text-[var(--admin-color-muted)]">فقط مشاهده</span>;
      return (
        <div className="flex flex-wrap justify-end gap-2">
          {canComplete ? (
            <Button size="sm" onClick={() => openOperation({ kind: 'complete', order })}>
              تکمیل و ثبت هزینه
            </Button>
          ) : null}
          {canOperate ? (
            <Button
              size="sm"
              variant="danger"
              onClick={() => openOperation({ kind: 'cancel', order })}
            >
              لغو عملیات
            </Button>
          ) : null}
        </div>
      );
    }
    return <span className="text-xs text-[var(--admin-color-muted)]">عملیات بسته شده</span>;
  }

  type Row = (typeof rowsWithSla)[number];
  const columns: readonly DataTableColumn<Row>[] = [
    {
      id: 'order',
      header: 'سفارش و کالا',
      cell: ({ order }) => (
        <div>
          <p className="font-bold">{toPersianDigits(order.orderNumber)}</p>
          <p className="mt-1 max-w-52 truncate text-xs text-[var(--admin-color-muted)]">
            {order.items.map((item) => item.productName).join('، ')}
          </p>
        </div>
      ),
    },
    {
      id: 'status',
      header: 'وضعیت',
      cell: ({ order }) => <StatusBadge status={order.fulfillmentStatus} />,
    },
    { id: 'sla', header: 'SLA', cell: ({ sla }) => <SlaBadge sla={sla} /> },
    {
      id: 'items',
      header: 'اقلام',
      align: 'center',
      visibility: 'lg',
      cell: ({ order }) => formatAdminInteger(order.items.length),
    },
    {
      id: 'cost',
      header: 'هزینه واقعی',
      visibility: 'lg',
      cell: ({ order }) =>
        order.fulfillment?.actualCostToman === null ||
        order.fulfillment?.actualCostToman === undefined
          ? '—'
          : formatAdminToman(order.fulfillment.actualCostToman),
    },
    {
      id: 'actions',
      header: 'عملیات',
      align: 'end',
      cell: ({ order }) => (
        <div className="flex flex-wrap justify-end gap-2">
          <Button size="sm" variant="outline" onClick={() => setDetailsOrder(order)}>
            جزئیات
          </Button>
          <Actions order={order} />
        </div>
      ),
    },
  ];

  const activeOrder = operation?.order;
  const operationIsDanger = operation?.kind === 'cancel';
  const actionFooter = (
    <>
      <Button variant="outline" disabled={pending} onClick={() => setOperation(null)}>
        انصراف
      </Button>
      <Button
        type="submit"
        form="plating-operation-form"
        variant={operationIsDanger ? 'danger' : 'primary'}
        loading={pending}
      >
        تأیید نهایی
      </Button>
    </>
  );

  return (
    <div className="space-y-6">
      {failed ? (
        <Alert tone="danger" title="دریافت صف آبکاری ناموفق بود">
          ارتباط با API را بررسی و صفحه را تازه‌سازی کنید.
        </Alert>
      ) : null}
      {success ? <Alert tone="success">{success}</Alert> : null}
      {!canOperate ? (
        <Alert tone="info">دسترسی شما برای این صف فقط خواندنی است.</Alert>
      ) : canOperate && !canComplete ? (
        <Alert tone="warning">
          شروع و لغو در دسترس است؛ ثبت هزینه واقعی به مجوز مالی نیاز دارد.
        </Alert>
      ) : null}

      <section aria-label="شاخص‌های صف آبکاری" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          label="در انتظار شروع"
          value={statusCounts.PENDING}
          tone={statusCounts.PENDING ? 'warning' : 'neutral'}
          description="سفارش آماده اقدام"
        />
        <Kpi
          label="در حال آبکاری"
          value={statusCounts.IN_PROGRESS}
          tone="info"
          description="کار فعال کارگاه"
        />
        <Kpi
          label="نزدیک سررسید"
          value={dueSoonCount}
          tone={dueSoonCount ? 'warning' : 'neutral'}
          description="کمتر از یک روز"
        />
        <Kpi
          label="عبور از SLA"
          value={overdueCount}
          tone={overdueCount ? 'danger' : 'success'}
          description="نیازمند رسیدگی فوری"
        />
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <WorkloadChart counts={statusCounts} />
      </section>

      <FilterBar
        activeCount={
          Number(Boolean(needle)) + Number(statusFilter !== 'all') + Number(slaFilter !== 'all')
        }
        resetAction={
          needle || statusFilter !== 'all' || slaFilter !== 'all' ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setSearch('');
                setStatusFilter('all');
                setSlaFilter('all');
              }}
            >
              پاک‌کردن فیلترها
            </Button>
          ) : undefined
        }
      >
        <SearchField
          aria-label="جستجوی صف آبکاری"
          value={search}
          placeholder="شماره سفارش، کالا، SKU یا مرجع کارگاه"
          onChange={(event) => setSearch(toPersianDigits(event.target.value))}
        />
        <Select
          aria-label="فیلتر وضعیت آبکاری"
          value={statusFilter}
          options={STATUS_OPTIONS}
          onValueChange={(value) => setStatusFilter(value as StatusFilter)}
        />
        <Select
          aria-label="فیلتر SLA آبکاری"
          value={slaFilter}
          options={SLA_OPTIONS}
          onValueChange={(value) => setSlaFilter(value as SlaFilter)}
        />
      </FilterBar>

      <ResponsiveDataView
        caption="صف سفارش‌های نیازمند آبکاری"
        mobileLabel="کارت‌های صف آبکاری"
        columns={columns}
        rows={filtered}
        getRowKey={({ order }) => order.orderId}
        getRowClassName={({ sla }) =>
          sla.state === 'OVERDUE' ? 'bg-[var(--admin-color-danger-soft)]/30' : undefined
        }
        emptyTitle={
          needle || statusFilter !== 'all' || slaFilter !== 'all'
            ? 'نتیجه‌ای پیدا نشد'
            : 'صف آبکاری خالی است'
        }
        emptyDescription="سفارش پرداخت‌شده دارای خدمت آبکاری در این بخش نمایش داده می‌شود."
        renderMobileCard={({ order, sla }) => (
          <MobileDataCard
            detailsOpen={mobileDetailsId === order.orderId}
            onDetailsOpenChange={(open) => setMobileDetailsId(open ? order.orderId : null)}
            title={toPersianDigits(order.orderNumber)}
            eyebrow={order.items.map((item) => item.productName).join('، ')}
            status={<StatusBadge status={order.fulfillmentStatus} />}
            items={[
              { label: 'وضعیت SLA', value: SLA[sla.state].label },
              {
                label: 'سررسید',
                value: sla.deadline ? formatAdminDateTime(sla.deadline) : 'ثبت نشده',
              },
              { label: 'تعداد اقلام', value: formatAdminInteger(order.items.length) },
              {
                label: 'هزینه واقعی',
                value:
                  order.fulfillment?.actualCostToman === null ||
                  order.fulfillment?.actualCostToman === undefined
                    ? 'ثبت نشده'
                    : formatAdminToman(order.fulfillment.actualCostToman),
              },
            ]}
            detailsTitle={`آبکاری سفارش ${toPersianDigits(order.orderNumber)}`}
            detailsDescription="اقلام، زمان‌بندی و سوابق عملیات"
            details={<OrderDetails order={order} sla={sla} />}
            detailsFooter={
              order.fulfillmentStatus === 'PENDING' || order.fulfillmentStatus === 'IN_PROGRESS' ? (
                <Actions order={order} />
              ) : undefined
            }
          />
        )}
      />

      <Dialog
        open={detailsOrder !== null}
        onOpenChange={(open) => {
          if (!open) setDetailsOrder(null);
        }}
      >
        <DialogContent
          size="lg"
          title={
            detailsOrder
              ? `آبکاری سفارش ${toPersianDigits(detailsOrder.orderNumber)}`
              : 'جزئیات آبکاری'
          }
          description="اقلام سفارش، SLA، هزینه و سوابق کامل عملیات"
        >
          {detailsOrder ? (
            <OrderDetails order={detailsOrder} sla={getPlatingSla(detailsOrder, now)} />
          ) : null}
        </DialogContent>
      </Dialog>

      <BottomSheet
        open={operation !== null}
        onOpenChange={(open) => {
          if (!open && !pending) setOperation(null);
        }}
      >
        <BottomSheetContent
          title={operationTitle(operation)}
          description={
            activeOrder
              ? `سفارش ${toPersianDigits(activeOrder.orderNumber)} را پیش از ثبت نهایی بررسی کنید.`
              : undefined
          }
          footer={actionFooter}
          height="content"
          hideClose={pending}
        >
          <form id="plating-operation-form" onSubmit={submit} className="space-y-4">
            {operation?.kind === 'complete' ? (
              <>
                <Alert tone="warning" title="ثبت مالی غیرقابل جایگزینی">
                  هزینه واقعی پس از تکمیل در دفتر هزینه سفارش ثبت می‌شود. مبلغ و مرجع فاکتور را با
                  سند کارگاه تطبیق دهید.
                </Alert>
                <FormField
                  id="plating-actual-cost"
                  label="هزینه واقعی آبکاری (تومان)"
                  required
                  hint="عدد صحیح و بدون جداکننده نیز قابل ورود است."
                >
                  {(props) => (
                    <Input
                      {...props}
                      inputMode="numeric"
                      value={actualCost}
                      placeholder="مثلاً ۱۴۰۰۰۰"
                      onChange={(event) => setActualCost(toPersianDigits(event.target.value))}
                      disabled={pending}
                    />
                  )}
                </FormField>
                <FormField id="plating-external-reference" label="شماره فاکتور یا مرجع کارگاه">
                  {(props) => (
                    <Input
                      {...props}
                      value={externalReference}
                      maxLength={255}
                      placeholder="مثلاً PL-۱۴۰۵-۱۲۸"
                      onChange={(event) =>
                        setExternalReference(toPersianDigits(event.target.value))
                      }
                      disabled={pending}
                    />
                  )}
                </FormField>
              </>
            ) : null}
            {operation?.kind === 'cancel' ? (
              <Alert tone="danger" title="لغو عملیات جاری">
                عملیات تکمیل‌شده از این مسیر لغو نمی‌شود. دلیل لغو در سابقه سفارش باقی می‌ماند.
              </Alert>
            ) : null}
            <FormField
              id="plating-operation-note"
              label={operation?.kind === 'cancel' ? 'دلیل لغو' : 'یادداشت عملیات'}
              required
              error={error || undefined}
              hint={
                operation?.kind === 'start'
                  ? 'نام کارگاه، نحوه تحویل یا نکته اجرایی را ثبت کنید.'
                  : 'حداقل ۳ نویسه؛ این متن در سابقه عملیات نگهداری می‌شود.'
              }
            >
              {(props) => (
                <Textarea
                  {...props}
                  value={note}
                  maxLength={1000}
                  placeholder={
                    operation?.kind === 'cancel'
                      ? 'علت توقف یا لغو آبکاری'
                      : operation?.kind === 'complete'
                        ? 'نتیجه نهایی و توضیح فاکتور کارگاه'
                        : 'شرح تحویل سفارش به کارگاه'
                  }
                  onChange={(event) => setNote(toPersianDigits(event.target.value))}
                  disabled={pending}
                />
              )}
            </FormField>
          </form>
        </BottomSheetContent>
      </BottomSheet>
    </div>
  );
}
