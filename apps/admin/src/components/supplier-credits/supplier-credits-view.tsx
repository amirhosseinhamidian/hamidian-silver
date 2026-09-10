'use client';

import { useMemo, useRef, useState } from 'react';

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
  parseSupplierCredit,
  supplierCreditRemainingAmount,
  type AdminSupplierCredit,
  type AdminSupplierCreditActor,
  type AdminSupplierCreditStatus,
} from '@/lib/supplier-credits/supplier-credits-model';

type Props = Readonly<{
  credits: readonly AdminSupplierCredit[];
  failed: boolean;
}>;

type StatusFilter = AdminSupplierCreditStatus | 'all';
type DetailMode = 'desktop' | 'mobile' | null;

const STATUS: Readonly<
  Record<AdminSupplierCreditStatus, Readonly<{ label: string; tone: BadgeTone }>>
> = {
  AVAILABLE: { label: 'قابل استفاده', tone: 'success' },
  PARTIALLY_APPLIED: { label: 'بخشی مصرف‌شده', tone: 'warning' },
  APPLIED: { label: 'مصرف‌شده', tone: 'neutral' },
  VOIDED: { label: 'باطل‌شده', tone: 'danger' },
};

const STATUS_OPTIONS = [
  { value: 'all', label: 'همه وضعیت‌ها' },
  { value: 'AVAILABLE', label: 'قابل استفاده' },
  { value: 'PARTIALLY_APPLIED', label: 'بخشی مصرف‌شده' },
  { value: 'APPLIED', label: 'مصرف‌شده' },
  { value: 'VOIDED', label: 'باطل‌شده' },
];

const SETTLEMENT_STATUS_LABELS: Readonly<Record<string, string>> = {
  DRAFT: 'پیش‌نویس',
  APPROVED: 'تأییدشده',
  PAID: 'پرداخت‌شده',
  CANCELLED: 'لغوشده',
};

function actorLabel(actor: AdminSupplierCreditActor | null): string {
  if (!actor) return 'ثبت نشده';
  return (
    [actor.firstName, actor.lastName].filter(Boolean).join(' ') || formatAdminPhone(actor.phone)
  );
}

function StatusBadge({ status }: Readonly<{ status: AdminSupplierCreditStatus }>) {
  return (
    <Badge tone={STATUS[status].tone} dot>
      {STATUS[status].label}
    </Badge>
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

function CreditApplications({ credit }: Readonly<{ credit: AdminSupplierCredit }>) {
  if (credit.applications.length === 0) {
    return (
      <p className="rounded-[var(--admin-radius-md)] bg-[var(--admin-color-surface-subtle)] p-3 text-sm text-[var(--admin-color-muted)]">
        این اعتبار هنوز در هیچ دوره تسویه‌ای استفاده نشده است.
      </p>
    );
  }
  return (
    <div className="grid gap-3">
      {credit.applications.map((application) => (
        <article
          key={application.id}
          className="rounded-[var(--admin-radius-md)] border border-[var(--admin-color-border)] p-3"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-bold">تسویه {toPersianDigits(application.settlementId)}</p>
              <p className="mt-1 text-xs text-[var(--admin-color-muted)]">
                {formatAdminDateTime(application.createdAt)} · {actorLabel(application.appliedBy)}
              </p>
            </div>
            <Badge tone={application.status === 'ACTIVE' ? 'info' : 'danger'}>
              {application.status === 'ACTIVE' ? 'اعمال فعال' : 'اعمال حذف‌شده'}
            </Badge>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-[var(--admin-radius-sm)] bg-[var(--admin-color-surface-subtle)] p-2">
              <p className="text-[0.6875rem] text-[var(--admin-color-subtle)]">مبلغ اعمال‌شده</p>
              <p className="mt-1 text-sm font-black">{formatAdminToman(application.amountToman)}</p>
            </div>
            <div className="rounded-[var(--admin-radius-sm)] bg-[var(--admin-color-surface-subtle)] p-2">
              <p className="text-[0.6875rem] text-[var(--admin-color-subtle)]">وضعیت تسویه</p>
              <p className="mt-1 text-sm font-black">
                {application.settlement
                  ? (SETTLEMENT_STATUS_LABELS[application.settlement.status] ??
                    toPersianDigits(application.settlement.status))
                  : 'ثبت نشده'}
              </p>
            </div>
          </div>
          {application.status === 'REMOVED' ? (
            <p className="mt-3 border-t border-[var(--admin-color-border)] pt-3 text-xs leading-6 text-[var(--admin-color-muted)]">
              حذف توسط {actorLabel(application.removedBy)}
              {application.removedAt ? ` در ${formatAdminDateTime(application.removedAt)}` : ''}
              {application.removalReason ? `؛ ${application.removalReason}` : ''}
            </p>
          ) : null}
        </article>
      ))}
    </div>
  );
}

function CreditDetails({ credit }: Readonly<{ credit: AdminSupplierCredit }>) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 lg:grid-cols-2">
        <Card title="منبع اعتبار">
          <DetailRows
            rows={[
              ['شماره سفارش', credit.order.orderNumber],
              ['محصول', credit.orderItem.productName],
              ['تنوع', credit.orderItem.variantName ?? 'تنوع پایه'],
              ['SKU', credit.orderItem.sku],
              ['تعداد بازگشتی', formatAdminInteger(credit.quantity)],
              ['شناسه مرجوعی', credit.returnItem.returnId],
              ['دلیل مرجوعی', credit.returnItem.returnReason ?? 'ثبت نشده'],
              ['یادداشت دریافت', credit.returnItem.receiveNote ?? 'ثبت نشده'],
            ]}
          />
        </Card>
        <Card title="مبلغ و وضعیت">
          <DetailRows
            rows={[
              ['تأمین‌کننده', credit.supplierName],
              ['وضعیت', STATUS[credit.status].label],
              ['قیمت خرید واحد', formatAdminToman(credit.unitSupplierPriceToman)],
              ['مبلغ کل اعتبار', formatAdminToman(credit.amountToman)],
              ['مبلغ مصرف‌شده', formatAdminToman(credit.appliedAmountToman)],
              ['مانده قابل استفاده', formatAdminToman(supplierCreditRemainingAmount(credit))],
              ['زمان ایجاد', formatAdminDateTime(credit.createdAt)],
              ['ثبت‌کننده', actorLabel(credit.createdBy)],
            ]}
          />
        </Card>
      </div>
      <Card
        title={`سابقه مصرف · ${formatAdminInteger(credit.applications.length)} رکورد`}
        description="اعمال و حذف اعتبار در دوره‌های تسویه تأمین‌کننده به‌ترتیب زمانی نمایش داده می‌شود."
      >
        <CreditApplications credit={credit} />
      </Card>
    </div>
  );
}

function detailErrorMessage(status: number): string {
  if (status === 401) return 'نشست مدیریتی منقضی شده است. دوباره وارد شوید.';
  if (status === 403) return 'مجوز مشاهده اطلاعات مالی را ندارید.';
  if (status === 404) return 'اعتبار تأمین‌کننده پیدا نشد.';
  return 'جزئیات اعتبار دریافت نشد. دوباره تلاش کنید.';
}

export function SupplierCreditsView({ credits, failed }: Props) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [selected, setSelected] = useState<AdminSupplierCredit | null>(null);
  const [detail, setDetail] = useState<AdminSupplierCredit | null>(null);
  const [detailMode, setDetailMode] = useState<DetailMode>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const detailRequest = useRef(0);
  const needle = toAsciiDigits(search).trim().toLocaleLowerCase('fa');

  const suppliers = useMemo(
    () =>
      [...new Map(credits.map((credit) => [credit.supplierId, credit.supplierName])).entries()]
        .map(([id, name]) => ({ value: id, label: name }))
        .sort((first, second) => first.label.localeCompare(second.label, 'fa')),
    [credits],
  );

  const totals = useMemo(
    () => ({
      created: credits.reduce((sum, credit) => sum + credit.amountToman, 0),
      applied: credits.reduce((sum, credit) => sum + credit.appliedAmountToman, 0),
      remaining: credits.reduce((sum, credit) => sum + supplierCreditRemainingAmount(credit), 0),
      open: credits.filter(
        (credit) => credit.status === 'AVAILABLE' || credit.status === 'PARTIALLY_APPLIED',
      ).length,
    }),
    [credits],
  );

  const statusCounts = useMemo(
    () => ({
      AVAILABLE: credits.filter((credit) => credit.status === 'AVAILABLE').length,
      PARTIALLY_APPLIED: credits.filter((credit) => credit.status === 'PARTIALLY_APPLIED').length,
      APPLIED: credits.filter((credit) => credit.status === 'APPLIED').length,
      VOIDED: credits.filter((credit) => credit.status === 'VOIDED').length,
    }),
    [credits],
  );

  const filtered = useMemo(
    () =>
      credits.filter((credit) => {
        if (statusFilter !== 'all' && credit.status !== statusFilter) return false;
        if (supplierFilter !== 'all' && credit.supplierId !== supplierFilter) return false;
        if (!needle) return true;
        return [
          credit.order.orderNumber,
          credit.supplierName,
          credit.orderItem.productName,
          credit.orderItem.variantName ?? '',
          credit.orderItem.sku,
          credit.returnItem.returnId,
        ].some((value) => toAsciiDigits(value).toLocaleLowerCase('fa').includes(needle));
      }),
    [credits, needle, statusFilter, supplierFilter],
  );

  async function openDetails(credit: AdminSupplierCredit, mode: Exclude<DetailMode, null>) {
    const requestId = detailRequest.current + 1;
    detailRequest.current = requestId;
    setSelected(credit);
    setDetail(credit);
    setDetailMode(mode);
    setDetailLoading(true);
    setDetailError('');
    try {
      const response = await fetch(`/api/supplier-credits/${encodeURIComponent(credit.id)}`);
      if (requestId !== detailRequest.current) return;
      if (!response.ok) {
        setDetailError(detailErrorMessage(response.status));
        return;
      }
      const parsed = parseSupplierCredit(await response.json());
      if (!parsed) {
        setDetailError('پاسخ جزئیات اعتبار معتبر نیست.');
        return;
      }
      setDetail(parsed);
    } catch {
      if (requestId === detailRequest.current) {
        setDetailError('ارتباط با سرور برقرار نشد. دوباره تلاش کنید.');
      }
    } finally {
      if (requestId === detailRequest.current) setDetailLoading(false);
    }
  }

  function closeDetails() {
    detailRequest.current += 1;
    setSelected(null);
    setDetail(null);
    setDetailMode(null);
    setDetailLoading(false);
    setDetailError('');
  }

  const columns: readonly DataTableColumn<AdminSupplierCredit>[] = [
    {
      id: 'source',
      header: 'منبع اعتبار',
      cell: (credit) => (
        <div>
          <p className="font-bold">{credit.orderItem.productName}</p>
          <p className="mt-1 text-xs text-[var(--admin-color-muted)]">
            سفارش {toPersianDigits(credit.order.orderNumber)} ·{' '}
            {toPersianDigits(credit.orderItem.sku)}
          </p>
        </div>
      ),
    },
    {
      id: 'supplier',
      header: 'تأمین‌کننده',
      cell: (credit) => credit.supplierName,
    },
    {
      id: 'status',
      header: 'وضعیت',
      cell: (credit) => <StatusBadge status={credit.status} />,
    },
    {
      id: 'amount',
      header: 'مبلغ اعتبار',
      align: 'end',
      cell: (credit) => formatAdminToman(credit.amountToman),
    },
    {
      id: 'applied',
      header: 'مصرف‌شده',
      align: 'end',
      visibility: 'lg',
      cell: (credit) => formatAdminToman(credit.appliedAmountToman),
    },
    {
      id: 'remaining',
      header: 'مانده',
      align: 'end',
      cell: (credit) => formatAdminToman(supplierCreditRemainingAmount(credit)),
    },
    {
      id: 'created',
      header: 'زمان ایجاد',
      visibility: 'lg',
      cell: (credit) => formatAdminDateTime(credit.createdAt),
    },
    {
      id: 'actions',
      header: 'جزئیات',
      align: 'end',
      cell: (credit) => (
        <Button size="sm" variant="outline" onClick={() => void openDetails(credit, 'desktop')}>
          مشاهده اعتبار
        </Button>
      ),
    },
  ];

  const activeFilterCount =
    Number(Boolean(needle)) + Number(statusFilter !== 'all') + Number(supplierFilter !== 'all');
  const shownDetail = detail ?? selected;
  const detailFooter = selected ? (
    <ButtonLink href="/returns" variant="outline" size="sm">
      مشاهده مرجوعی‌ها
    </ButtonLink>
  ) : undefined;
  const detailContent = shownDetail ? (
    <div className="space-y-4">
      {detailLoading ? <Alert tone="info">در حال دریافت سابقه کامل اعتبار…</Alert> : null}
      {detailError ? <Alert tone="danger">{detailError}</Alert> : null}
      <CreditDetails credit={shownDetail} />
    </div>
  ) : null;

  return (
    <div className="space-y-6">
      {failed ? (
        <Alert tone="danger" title="فهرست اعتبارها دریافت نشد">
          اتصال API و دسترسی مالی را بررسی و صفحه را تازه‌سازی کنید.
        </Alert>
      ) : null}
      <Alert tone="info">
        این صفحه فقط‌خواندنی است. اعتبار پس از دریافت مرجوعی با مسیر «بازگشت به تأمین‌کننده» ایجاد
        می‌شود؛ اعمال آن روی دوره تسویه در مرحله {formatAdminInteger(30)} انجام خواهد شد.
      </Alert>

      <section
        aria-label="شاخص‌های اعتبار تأمین‌کننده"
        className="grid grid-cols-2 gap-3 lg:grid-cols-4"
      >
        <Kpi
          label="مانده قابل استفاده"
          value={formatAdminToman(totals.remaining)}
          description="قابل کسر از تسویه‌های آتی"
          tone={totals.remaining ? 'success' : 'neutral'}
        />
        <Kpi
          label="اعتبار ایجادشده"
          value={formatAdminToman(totals.created)}
          description="مجموع اعتبار ناشی از مرجوعی"
          tone="info"
        />
        <Kpi
          label="مبلغ مصرف‌شده"
          value={formatAdminToman(totals.applied)}
          description="اعمال‌شده روی دوره‌های تسویه"
          tone="warning"
        />
        <Kpi
          label="اعتبار باز"
          value={formatAdminInteger(totals.open)}
          description="قابل استفاده یا بخشی مصرف‌شده"
          tone={totals.open ? 'warning' : 'success'}
        />
      </section>

      <Card
        title="ترکیب وضعیت اعتبارها"
        description="تعداد اعتبارهای قابل استفاده، مصرف‌شده و باطل‌شده"
      >
        <DonutChart
          title="ترکیب وضعیت اعتبارهای تأمین‌کننده"
          centerLabel="اعتبار"
          segments={[
            {
              label: 'قابل استفاده',
              value: statusCounts.AVAILABLE,
              color: 'var(--admin-color-success)',
            },
            {
              label: 'بخشی مصرف‌شده',
              value: statusCounts.PARTIALLY_APPLIED,
              color: 'var(--admin-color-warning)',
            },
            { label: 'مصرف‌شده', value: statusCounts.APPLIED, color: 'var(--admin-color-info)' },
            { label: 'باطل‌شده', value: statusCounts.VOIDED, color: 'var(--admin-color-danger)' },
          ]}
        />
      </Card>

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
                setSupplierFilter('all');
              }}
            >
              بازنشانی فیلترها
            </Button>
          ) : undefined
        }
      >
        <SearchField
          aria-label="جستجوی اعتبار تأمین‌کننده"
          value={search}
          placeholder="سفارش، محصول، SKU یا تأمین‌کننده"
          onChange={(event) => setSearch(toPersianDigits(event.target.value))}
        />
        <Select
          aria-label="فیلتر وضعیت اعتبار"
          value={statusFilter}
          options={STATUS_OPTIONS}
          onValueChange={(value) => setStatusFilter(value as StatusFilter)}
        />
        <Select
          aria-label="فیلتر تأمین‌کننده"
          value={supplierFilter}
          options={[{ value: 'all', label: 'همه تأمین‌کنندگان' }, ...suppliers]}
          onValueChange={setSupplierFilter}
        />
      </FilterBar>

      <ResponsiveDataView
        caption="اعتبارهای تأمین‌کنندگان"
        mobileLabel="کارت‌های اعتبار تأمین‌کننده"
        columns={columns}
        rows={filtered}
        getRowKey={(credit) => credit.id}
        emptyTitle={activeFilterCount ? 'نتیجه‌ای پیدا نشد' : 'اعتباری ثبت نشده است'}
        emptyDescription="اعتبارهای ناشی از بازگشت کالا به تأمین‌کننده در این بخش نمایش داده می‌شوند."
        renderMobileCard={(credit) => (
          <MobileDataCard
            detailsOpen={detailMode === 'mobile' && selected?.id === credit.id}
            onDetailsOpenChange={(open) =>
              open ? void openDetails(credit, 'mobile') : closeDetails()
            }
            title={credit.orderItem.productName}
            eyebrow={`سفارش ${toPersianDigits(credit.order.orderNumber)}`}
            status={<StatusBadge status={credit.status} />}
            items={[
              { label: 'تأمین‌کننده', value: credit.supplierName },
              { label: 'مبلغ', value: formatAdminToman(credit.amountToman) },
              { label: 'مصرف‌شده', value: formatAdminToman(credit.appliedAmountToman) },
              { label: 'مانده', value: formatAdminToman(supplierCreditRemainingAmount(credit)) },
            ]}
            detailsLabel="مشاهده جزئیات اعتبار"
            detailsTitle={`اعتبار سفارش ${toPersianDigits(credit.order.orderNumber)}`}
            detailsDescription={`${credit.supplierName} · ${STATUS[credit.status].label}`}
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
              ? `اعتبار سفارش ${toPersianDigits(selected.order.orderNumber)}`
              : 'جزئیات اعتبار تأمین‌کننده'
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
