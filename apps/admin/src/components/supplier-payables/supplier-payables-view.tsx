'use client';

import { useMemo, useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { DataTableColumn } from '@/components/ui/data-table';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { DonutChart } from '@/components/ui/donut-chart';
import { FilterBar, SearchField } from '@/components/ui/filter-bar';
import { MobileDataCard } from '@/components/ui/mobile-data-card';
import { ResponsiveDataView } from '@/components/ui/responsive-data-view';
import { Select } from '@/components/ui/select';
import {
  formatAdminDateTime,
  formatAdminInteger,
  formatAdminPhone,
  formatAdminToman,
  toAsciiDigits,
  toPersianDigits,
} from '@/lib/presentation/formatters';
import {
  supplierPayablePeriod,
  type AdminSupplierPayable,
  type AdminSupplierPayableActor,
  type AdminSupplierPayableStatus,
  type AdminSupplierPayableSummary,
} from '@/lib/supplier-payables/supplier-payables-model';

type Props = Readonly<{
  payables: readonly AdminSupplierPayable[];
  summary: readonly AdminSupplierPayableSummary[];
  failed: boolean;
}>;

type StatusFilter = AdminSupplierPayableStatus | 'all';
type SettlementFilter = 'all' | 'ready' | 'batch' | 'direct';
type DetailMode = 'desktop' | 'mobile' | null;

const STATUS: Readonly<
  Record<AdminSupplierPayableStatus, Readonly<{ label: string; tone: BadgeTone }>>
> = {
  OPEN: { label: 'تسویه‌نشده', tone: 'warning' },
  PAID: { label: 'تسویه‌شده', tone: 'success' },
};

const STATUS_OPTIONS = [
  { value: 'all', label: 'همه وضعیت‌ها' },
  { value: 'OPEN', label: 'تسویه‌نشده' },
  { value: 'PAID', label: 'تسویه‌شده' },
];

const SETTLEMENT_OPTIONS = [
  { value: 'all', label: 'همه روش‌های تسویه' },
  { value: 'ready', label: 'آماده ورود به دوره' },
  { value: 'batch', label: 'دارای دوره تسویه' },
  { value: 'direct', label: 'پرداخت مستقیم' },
];

function actorLabel(actor: AdminSupplierPayableActor | null): string {
  if (!actor) return 'ثبت نشده';
  return (
    [actor.firstName, actor.lastName].filter(Boolean).join(' ') || formatAdminPhone(actor.phone)
  );
}

function settlementKind(payable: AdminSupplierPayable): Exclude<SettlementFilter, 'all'> {
  if (payable.settlementId) return 'batch';
  return payable.status === 'PAID' ? 'direct' : 'ready';
}

function settlementLabel(payable: AdminSupplierPayable): string {
  const kind = settlementKind(payable);
  if (kind === 'batch') {
    return payable.status === 'PAID' ? 'پرداخت از دوره تسویه' : 'در دوره تسویه';
  }
  return kind === 'direct' ? 'پرداخت مستقیم' : 'آماده ورود به دوره';
}

function StatusBadge({ status }: Readonly<{ status: AdminSupplierPayableStatus }>) {
  return (
    <Badge tone={STATUS[status].tone} dot>
      {STATUS[status].label}
    </Badge>
  );
}

function SettlementBadge({ payable }: Readonly<{ payable: AdminSupplierPayable }>) {
  const kind = settlementKind(payable);
  const tone: BadgeTone = kind === 'ready' ? 'info' : kind === 'batch' ? 'neutral' : 'success';
  return <Badge tone={tone}>{settlementLabel(payable)}</Badge>;
}

function Kpi({
  label,
  value,
  description,
  tone,
}: Readonly<{ label: string; value: string; description: string; tone: BadgeTone }>) {
  return (
    <Card className="h-full">
      <Badge tone={tone}>{label}</Badge>
      <p className="mt-3 text-xl font-black tabular-nums sm:text-2xl">{value}</p>
      <p className="mt-1 text-xs text-[var(--admin-color-muted)]">{description}</p>
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

function PayableDetails({ payable }: Readonly<{ payable: AdminSupplierPayable }>) {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <Card title="منبع بدهی">
        <DetailRows
          rows={[
            ['شماره سفارش', payable.order.orderNumber],
            ['وضعیت سفارش', payable.order.status],
            ['محصول', payable.orderItem.productName],
            ['تنوع', payable.orderItem.variantName ?? 'تنوع پایه'],
            ['SKU', payable.orderItem.sku],
            ['تعداد', formatAdminInteger(payable.quantity)],
            ['قیمت خرید واحد', formatAdminToman(payable.unitSupplierPriceToman)],
            ['زمان ایجاد بدهی', formatAdminDateTime(payable.createdAt)],
          ]}
        />
      </Card>
      <Card title="وضعیت مالی">
        <DetailRows
          rows={[
            ['تأمین‌کننده', payable.supplierName],
            ['مبلغ بدهی', formatAdminToman(payable.amountToman)],
            ['وضعیت', STATUS[payable.status].label],
            ['روش تسویه', settlementLabel(payable)],
            ['دوره', supplierPayablePeriod(payable.createdAt)],
            ['شناسه batch', payable.settlementId ?? 'ثبت نشده'],
            ['زمان پرداخت', payable.paidAt ? formatAdminDateTime(payable.paidAt) : 'پرداخت نشده'],
            ['ثبت‌کننده پرداخت', actorLabel(payable.paidBy)],
            ['مرجع پرداخت', payable.paymentReference ?? 'ثبت نشده'],
            ['یادداشت تسویه', payable.settlementNote ?? 'ثبت نشده'],
          ]}
        />
      </Card>
    </div>
  );
}

function SupplierExposureChart({
  rows,
}: Readonly<{ rows: readonly AdminSupplierPayableSummary[] }>) {
  const visible = [...rows]
    .filter((row) => row.openAmountToman > 0)
    .sort((first, second) => second.openAmountToman - first.openAmountToman)
    .slice(0, 6);
  const maximum = Math.max(...visible.map((row) => row.openAmountToman), 0);

  return (
    <Card
      title="بیشترین مانده بدهی"
      description="تأمین‌کنندگان با بیشترین مبلغ تسویه‌نشده"
      className="h-full"
    >
      {visible.length ? (
        <div role="img" aria-label="نمودار مانده بدهی تأمین‌کنندگان" className="space-y-3.5">
          {visible.map((row) => (
            <div key={row.supplierId}>
              <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
                <span className="truncate font-semibold">{row.supplierName}</span>
                <strong className="shrink-0 tabular-nums">
                  {formatAdminToman(row.openAmountToman)}
                </strong>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[var(--admin-color-surface-hover)]">
                <div
                  className="h-full rounded-full bg-[var(--admin-color-warning)]"
                  style={{ width: `${maximum ? (row.openAmountToman / maximum) * 100 : 0}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-[var(--admin-color-muted)]">مانده تسویه‌نشده‌ای وجود ندارد.</p>
      )}
    </Card>
  );
}

function PeriodOverview({ payables }: Readonly<{ payables: readonly AdminSupplierPayable[] }>) {
  const periods = [...payables]
    .reduce((map, payable) => {
      const key = supplierPayablePeriod(payable.createdAt);
      const row = map.get(key) ?? {
        label: key,
        open: 0,
        paid: 0,
        count: 0,
        latest: payable.createdAt,
      };
      row[payable.status === 'OPEN' ? 'open' : 'paid'] += payable.amountToman;
      row.count += 1;
      if (payable.createdAt > row.latest) row.latest = payable.createdAt;
      map.set(key, row);
      return map;
    }, new Map<string, { label: string; open: number; paid: number; count: number; latest: string }>())
    .values();
  const visible = [...periods]
    .sort((first, second) => second.latest.localeCompare(first.latest))
    .slice(0, 4);

  return (
    <Card title="مرور دوره‌ها" description="چهار دوره اخیر ایجاد بدهی">
      {visible.length ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {visible.map((period) => (
            <article
              key={period.label}
              className="rounded-[var(--admin-radius-md)] border border-[var(--admin-color-border)] p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <strong className="text-sm">{period.label}</strong>
                <Badge tone="neutral">{formatAdminInteger(period.count)} رکورد</Badge>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <dt className="text-[var(--admin-color-muted)]">تسویه‌نشده</dt>
                  <dd className="mt-1 font-black">{formatAdminToman(period.open)}</dd>
                </div>
                <div>
                  <dt className="text-[var(--admin-color-muted)]">تسویه‌شده</dt>
                  <dd className="mt-1 font-black">{formatAdminToman(period.paid)}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      ) : (
        <p className="text-sm text-[var(--admin-color-muted)]">دوره‌ای برای نمایش وجود ندارد.</p>
      )}
    </Card>
  );
}

export function SupplierPayablesView({ payables, summary, failed }: Props) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [settlementFilter, setSettlementFilter] = useState<SettlementFilter>('all');
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [periodFilter, setPeriodFilter] = useState('all');
  const [selected, setSelected] = useState<AdminSupplierPayable | null>(null);
  const [detailMode, setDetailMode] = useState<DetailMode>(null);
  const needle = toAsciiDigits(search).trim().toLocaleLowerCase('fa');

  const totals = useMemo(
    () => ({
      openAmount: summary.reduce((sum, row) => sum + row.openAmountToman, 0),
      paidAmount: summary.reduce((sum, row) => sum + row.paidAmountToman, 0),
      openCount: summary.reduce((sum, row) => sum + row.openCount, 0),
      exposedSuppliers: summary.filter((row) => row.openAmountToman > 0).length,
    }),
    [summary],
  );

  const suppliers = useMemo(
    () =>
      summary
        .map((row) => ({ value: row.supplierId, label: row.supplierName }))
        .sort((first, second) => first.label.localeCompare(second.label, 'fa')),
    [summary],
  );

  const periods = useMemo(
    () =>
      [...new Set(payables.map((payable) => supplierPayablePeriod(payable.createdAt)))].map(
        (period) => ({ value: period, label: period }),
      ),
    [payables],
  );

  const filtered = useMemo(
    () =>
      payables.filter((payable) => {
        if (statusFilter !== 'all' && payable.status !== statusFilter) return false;
        if (settlementFilter !== 'all' && settlementKind(payable) !== settlementFilter)
          return false;
        if (supplierFilter !== 'all' && payable.supplierId !== supplierFilter) return false;
        if (periodFilter !== 'all' && supplierPayablePeriod(payable.createdAt) !== periodFilter) {
          return false;
        }
        if (!needle) return true;
        return [
          payable.order.orderNumber,
          payable.supplierName,
          payable.orderItem.productName,
          payable.orderItem.variantName ?? '',
          payable.orderItem.sku,
          payable.paymentReference ?? '',
          payable.settlementId ?? '',
        ].some((value) => toAsciiDigits(value).toLocaleLowerCase('fa').includes(needle));
      }),
    [needle, payables, periodFilter, settlementFilter, statusFilter, supplierFilter],
  );

  function openDetails(payable: AdminSupplierPayable, mode: Exclude<DetailMode, null>) {
    setSelected(payable);
    setDetailMode(mode);
  }

  function closeDetails() {
    setSelected(null);
    setDetailMode(null);
  }

  const columns: readonly DataTableColumn<AdminSupplierPayable>[] = [
    {
      id: 'source',
      header: 'سفارش و محصول',
      cell: (payable) => (
        <div>
          <p className="font-bold">{payable.orderItem.productName}</p>
          <p className="mt-1 text-xs text-[var(--admin-color-muted)]">
            سفارش {toPersianDigits(payable.order.orderNumber)} ·{' '}
            {toPersianDigits(payable.orderItem.sku)}
          </p>
        </div>
      ),
    },
    { id: 'supplier', header: 'تأمین‌کننده', cell: (payable) => payable.supplierName },
    {
      id: 'period',
      header: 'دوره',
      visibility: 'lg',
      cell: (payable) => supplierPayablePeriod(payable.createdAt),
    },
    {
      id: 'status',
      header: 'وضعیت',
      cell: (payable) => <StatusBadge status={payable.status} />,
    },
    {
      id: 'settlement',
      header: 'مسیر تسویه',
      visibility: 'lg',
      cell: (payable) => <SettlementBadge payable={payable} />,
    },
    {
      id: 'amount',
      header: 'مبلغ بدهی',
      align: 'end',
      cell: (payable) => <strong>{formatAdminToman(payable.amountToman)}</strong>,
    },
    {
      id: 'actions',
      header: 'جزئیات',
      align: 'end',
      cell: (payable) => (
        <Button size="sm" variant="outline" onClick={() => openDetails(payable, 'desktop')}>
          مشاهده بدهی
        </Button>
      ),
    },
  ];

  const activeFilterCount =
    Number(Boolean(needle)) +
    Number(statusFilter !== 'all') +
    Number(settlementFilter !== 'all') +
    Number(supplierFilter !== 'all') +
    Number(periodFilter !== 'all');
  const detailFooter = selected ? (
    <div className="flex flex-wrap justify-end gap-2">
      <ButtonLink href="/orders" size="sm" variant="outline">
        مشاهده سفارش‌ها
      </ButtonLink>
      <ButtonLink href="/supplier-credits" size="sm" variant="ghost">
        اعتبار تأمین‌کنندگان
      </ButtonLink>
    </div>
  ) : undefined;
  const detailContent = selected ? <PayableDetails payable={selected} /> : null;

  return (
    <div className="space-y-6">
      {failed ? (
        <Alert tone="danger" title="اطلاعات بدهی تأمین‌کنندگان دریافت نشد">
          اتصال API و دسترسی مالی را بررسی و صفحه را تازه‌سازی کنید.
        </Alert>
      ) : null}
      <Alert tone="info">
        این صفحه فقط‌خواندنی است. ایجاد، تأیید و ثبت پرداخت batchهای تسویه در مرحله{' '}
        {formatAdminInteger(30)} انجام می‌شود؛ هیچ بدهی از این صفحه پرداخت یا تغییر نمی‌کند.
      </Alert>

      <section
        aria-label="شاخص‌های بدهی تأمین‌کنندگان"
        className="grid grid-cols-2 gap-3 lg:grid-cols-4"
      >
        <Kpi
          label="مانده قابل پرداخت"
          value={formatAdminToman(totals.openAmount)}
          description="مجموع بدهی‌های تسویه‌نشده"
          tone={totals.openAmount ? 'warning' : 'success'}
        />
        <Kpi
          label="پرداخت‌شده"
          value={formatAdminToman(totals.paidAmount)}
          description="مجموع بدهی‌های تسویه‌شده"
          tone="success"
        />
        <Kpi
          label="رکورد باز"
          value={formatAdminInteger(totals.openCount)}
          description="آیتم‌های در انتظار تسویه"
          tone={totals.openCount ? 'warning' : 'neutral'}
        />
        <Kpi
          label="تأمین‌کننده طلبکار"
          value={formatAdminInteger(totals.exposedSuppliers)}
          description="دارای مانده قابل پرداخت"
          tone={totals.exposedSuppliers ? 'info' : 'neutral'}
        />
      </section>

      <section aria-label="نمودارهای بدهی تأمین‌کنندگان" className="grid gap-3 lg:grid-cols-2">
        <Card title="ترکیب وضعیت مالی" description="مبلغ بدهی تسویه‌شده و تسویه‌نشده">
          <DonutChart
            title="ترکیب مبلغ بدهی تأمین‌کنندگان"
            centerLabel="تومان"
            segments={[
              {
                label: 'تسویه‌نشده',
                value: totals.openAmount,
                color: 'var(--admin-color-warning)',
              },
              {
                label: 'تسویه‌شده',
                value: totals.paidAmount,
                color: 'var(--admin-color-success)',
              },
            ]}
          />
        </Card>
        <SupplierExposureChart rows={summary} />
      </section>

      <PeriodOverview payables={payables} />

      <FilterBar
        activeCount={activeFilterCount}
        resetAction={
          activeFilterCount ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setSearch('');
                setStatusFilter('all');
                setSettlementFilter('all');
                setSupplierFilter('all');
                setPeriodFilter('all');
              }}
            >
              بازنشانی فیلترها
            </Button>
          ) : undefined
        }
      >
        <SearchField
          aria-label="جستجوی بدهی تأمین‌کننده"
          value={search}
          placeholder="سفارش، محصول، SKU، مرجع یا تأمین‌کننده"
          onChange={(event) => setSearch(toPersianDigits(event.target.value))}
        />
        <Select
          aria-label="فیلتر وضعیت بدهی"
          value={statusFilter}
          options={STATUS_OPTIONS}
          onValueChange={(value) => setStatusFilter(value as StatusFilter)}
        />
        <Select
          aria-label="فیلتر مسیر تسویه"
          value={settlementFilter}
          options={SETTLEMENT_OPTIONS}
          onValueChange={(value) => setSettlementFilter(value as SettlementFilter)}
        />
        <Select
          aria-label="فیلتر تأمین‌کننده بدهی"
          value={supplierFilter}
          options={[{ value: 'all', label: 'همه تأمین‌کنندگان' }, ...suppliers]}
          onValueChange={setSupplierFilter}
        />
        <Select
          aria-label="فیلتر دوره بدهی"
          value={periodFilter}
          options={[{ value: 'all', label: 'همه دوره‌ها' }, ...periods]}
          onValueChange={setPeriodFilter}
        />
      </FilterBar>

      <ResponsiveDataView
        caption="بدهی‌های تأمین‌کنندگان"
        mobileLabel="کارت‌های بدهی تأمین‌کنندگان"
        columns={columns}
        rows={filtered}
        getRowKey={(payable) => payable.id}
        emptyTitle={activeFilterCount ? 'نتیجه‌ای پیدا نشد' : 'بدهی تأمین‌کننده‌ای ثبت نشده است'}
        emptyDescription="بدهی حاصل از اقلام سفارش‌های پرداخت‌شده در این بخش نمایش داده می‌شود."
        renderMobileCard={(payable) => (
          <MobileDataCard
            detailsOpen={detailMode === 'mobile' && selected?.id === payable.id}
            onDetailsOpenChange={(open) => (open ? openDetails(payable, 'mobile') : closeDetails())}
            title={payable.supplierName}
            eyebrow={`سفارش ${toPersianDigits(payable.order.orderNumber)}`}
            status={<StatusBadge status={payable.status} />}
            items={[
              { label: 'محصول', value: payable.orderItem.productName },
              { label: 'مبلغ بدهی', value: formatAdminToman(payable.amountToman) },
              { label: 'دوره', value: supplierPayablePeriod(payable.createdAt) },
              { label: 'مسیر', value: settlementLabel(payable) },
            ]}
            detailsLabel="مشاهده جزئیات بدهی"
            detailsTitle={`بدهی سفارش ${toPersianDigits(payable.order.orderNumber)}`}
            detailsDescription={`${payable.supplierName} · ${STATUS[payable.status].label}`}
            details={detailContent}
            detailsFooter={detailFooter}
          />
        )}
      />

      <Dialog
        open={detailMode === 'desktop'}
        onOpenChange={(open) => {
          if (!open) closeDetails();
        }}
      >
        <DialogContent
          size="lg"
          title={
            selected
              ? `بدهی سفارش ${toPersianDigits(selected.order.orderNumber)}`
              : 'جزئیات بدهی تأمین‌کننده'
          }
          description={
            selected ? `${selected.supplierName} · ${STATUS[selected.status].label}` : undefined
          }
          footer={detailFooter}
        >
          {detailContent}
        </DialogContent>
      </Dialog>
    </div>
  );
}
