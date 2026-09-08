import Link from 'next/link';
import type { ReactNode } from 'react';

import { AdminIcon, type AdminIconName } from '@/components/layout/admin-icon';
import { Alert } from '@/components/ui/alert';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { DataTableColumn } from '@/components/ui/data-table';
import { DonutChart } from '@/components/ui/donut-chart';
import { ResponsiveDataView } from '@/components/ui/responsive-data-view';
import type {
  AdminFinancialReportsData,
  FinancialReportResource,
} from '@/lib/financial-reports/financial-reports-data';
import type {
  FinanceCostReconciliationRow,
  FinanceSupplierRow,
  FinancialReportPeriod,
  MissingOrderCostCode,
} from '@/lib/financial-reports/financial-reports-model';
import {
  formatAdminDateTime,
  formatAdminInteger,
  formatAdminToman,
} from '@/lib/presentation/formatters';
import { cn } from '@/lib/ui/cn';

const PERIODS: readonly Readonly<{
  value: FinancialReportPeriod;
  label: string;
  description: string;
}>[] = [
  { value: '7d', label: '۷ روز', description: 'هفت روز اخیر' },
  { value: '30d', label: '۳۰ روز', description: 'سی روز اخیر' },
  { value: '90d', label: '۹۰ روز', description: 'نود روز اخیر' },
  { value: 'all', label: 'همه', description: 'تمام سوابق' },
];

const MISSING_COSTS: Record<MissingOrderCostCode, string> = {
  PAYMENT_GATEWAY_FEE_MISSING: 'کارمزد درگاه',
  SHIPPING_PROVIDER_COST_MISSING: 'هزینه ارسال',
  PLATING_SERVICE_COST_MISSING: 'هزینه آبکاری',
};

function signedTone(value: number): BadgeTone {
  return value < 0 ? 'danger' : value > 0 ? 'success' : 'neutral';
}

function ResourceAlert({
  resource,
  children,
}: Readonly<{ resource: FinancialReportResource<unknown>; children: string }>) {
  return resource.failed ? (
    <Alert tone="danger" title="بخشی از گزارش در دسترس نیست">
      {children}
    </Alert>
  ) : null;
}

function KpiCard({
  title,
  value,
  description,
  icon,
  tone = 'primary',
}: Readonly<{
  title: string;
  value: ReactNode;
  description: string;
  icon: AdminIconName;
  tone?: 'primary' | 'success' | 'warning' | 'danger';
}>) {
  const toneClass = {
    primary: 'bg-blue-50 text-blue-700',
    success: 'bg-emerald-50 text-emerald-700',
    warning: 'bg-amber-50 text-amber-700',
    danger: 'bg-red-50 text-red-700',
  }[tone];

  return (
    <article className="rounded-[var(--admin-radius-lg)] border border-[var(--admin-color-border)] bg-[var(--admin-color-surface)] p-4 shadow-[var(--admin-shadow-sm)]">
      <span className={cn('grid size-9 place-items-center rounded-lg', toneClass)}>
        <AdminIcon name={icon} className="size-5" />
      </span>
      <p className="mt-4 text-xs font-semibold text-[var(--admin-color-muted)]">{title}</p>
      <div className="mt-1 min-h-9 text-lg leading-8 font-black break-words tabular-nums sm:text-xl">
        {value}
      </div>
      <p className="mt-1 text-[0.6875rem] leading-5 text-[var(--admin-color-subtle)]">
        {description}
      </p>
    </article>
  );
}

function PeriodSelector({ period }: Readonly<{ period: FinancialReportPeriod }>) {
  return (
    <nav
      aria-label="بازه زمانی گزارش‌های مالی"
      className="inline-flex max-w-full overflow-x-auto rounded-lg border border-[var(--admin-color-border)] bg-white p-1"
    >
      {PERIODS.map((option) => (
        <Link
          key={option.value}
          href={`/finance?period=${option.value}`}
          aria-current={period === option.value ? 'page' : undefined}
          title={option.description}
          className={cn(
            'min-w-max rounded-md px-3 py-1.5 text-xs font-bold outline-none transition-colors focus-visible:shadow-[var(--admin-focus-ring)]',
            period === option.value
              ? 'bg-[var(--admin-color-ink)] text-white!'
              : 'text-[var(--admin-color-muted)] hover:bg-[var(--admin-color-surface-hover)] hover:text-[var(--admin-color-ink)]',
          )}
        >
          {option.label}
        </Link>
      ))}
    </nav>
  );
}

function FlowBar({
  label,
  value,
  max,
  color,
}: Readonly<{ label: string; value: number; max: number; color: string }>) {
  const width = max === 0 ? 0 : Math.max(3, (Math.abs(value) / max) * 100);
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-4 text-xs">
        <span className="text-[var(--admin-color-muted)]">{label}</span>
        <span className="font-black tabular-nums">{formatAdminToman(value)}</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-[var(--admin-color-surface-hover)]">
        <div
          className="h-full rounded-full transition-[width]"
          style={{ width: `${width}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

function CashflowPanel({ data }: Readonly<{ data: AdminFinancialReportsData }>) {
  const cashflow = data.cashflow.data;
  if (!cashflow) {
    return (
      <Card title="جریان نقدی" description="ورودی مشتری و خروجی‌های قطعی دوره">
        <ResourceAlert resource={data.cashflow}>داده جریان نقدی از سرویس مالی دریافت نشد.</ResourceAlert>
      </Card>
    );
  }
  const rows = [
    { label: 'دریافت از مشتری', value: cashflow.customerCashInToman, color: 'var(--admin-color-success)' },
    { label: 'بازپرداخت مشتری', value: cashflow.customerRefundCashOutToman, color: 'var(--admin-color-danger)' },
    { label: 'پرداخت نقدی تأمین‌کننده', value: cashflow.supplierCashOutToman, color: 'var(--admin-color-warning)' },
    { label: 'جریان نقد عملیاتی خالص', value: cashflow.netOperatingCashflowToman, color: 'var(--admin-color-primary)' },
  ];
  const max = Math.max(0, ...rows.map((row) => Math.abs(row.value)));

  return (
    <Card title="جریان نقدی" description="ورودی مشتری و خروجی‌های قطعی دوره">
      <div role="img" aria-label="نمودار جریان نقدی دوره" className="space-y-4">
        {rows.map((row) => <FlowBar key={row.label} {...row} max={max} />)}
      </div>
      <dl className="mt-5 grid grid-cols-2 gap-2 border-t border-[var(--admin-color-border)] pt-4 text-xs">
        <SmallStat label="سفارش پرداخت‌شده" value={formatAdminInteger(cashflow.customerCashInOrderCount)} />
        <SmallStat label="تعداد بازپرداخت" value={formatAdminInteger(cashflow.customerRefundCount)} />
        <SmallStat label="دوره تسویه پرداخت‌شده" value={formatAdminInteger(cashflow.supplierSettlementCount)} />
        <SmallStat label="پرداخت مستقیم بدهی" value={formatAdminInteger(cashflow.supplierDirectPaymentCount)} />
      </dl>
    </Card>
  );
}

function SmallStat({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="rounded-lg bg-[var(--admin-color-surface-subtle)] p-3">
      <dt className="text-[0.6875rem] leading-5 text-[var(--admin-color-muted)]">{label}</dt>
      <dd className="mt-1 font-black tabular-nums">{value}</dd>
    </div>
  );
}

function ContributionPanel({ data }: Readonly<{ data: AdminFinancialReportsData }>) {
  const contribution = data.contribution.data;
  if (!contribution) {
    return (
      <Card title="حاشیه مشارکت" description="سود پس از هزینه‌های خدمات و بازپرداخت">
        <ResourceAlert resource={data.contribution}>داده سود و هزینه از سرویس مالی دریافت نشد.</ResourceAlert>
      </Card>
    );
  }

  return (
    <Card title="حاشیه مشارکت" description="سود پس از هزینه‌های خدمات و بازپرداخت">
      <dl className="space-y-3 text-sm">
        <ReportLine label="سود ناخالص پیش از خدمات" value={contribution.grossProfitBeforeServiceCostsToman} />
        <ReportLine label="جمع هزینه‌های عملیاتی" value={-contribution.operatingServiceCostToman} />
        <ReportLine label="حاشیه مشارکت" value={contribution.contributionMarginToman} strong />
        <ReportLine label="بازپرداخت تأییدشده" value={-contribution.confirmedRefundToman} />
        <ReportLine label="مشارکت خالص پس از بازپرداخت" value={contribution.contributionAfterRefundsToman} strong />
      </dl>
      <div className="mt-5 border-t border-[var(--admin-color-border)] pt-4">
        <DonutChart
          title="ترکیب هزینه‌های عملیاتی سفارش"
          centerLabel="تومان هزینه"
          segments={[
            { label: 'کارمزد درگاه', value: Math.max(0, contribution.paymentGatewayFeeToman), color: '#2563eb' },
            { label: 'ارسال', value: Math.max(0, contribution.shippingProviderCostToman), color: '#d97706' },
            { label: 'آبکاری', value: Math.max(0, contribution.platingServiceCostToman), color: '#7c3aed' },
            { label: 'اصلاح دستی', value: Math.max(0, contribution.manualCostAdjustmentToman), color: '#64748b' },
          ]}
        />
      </div>
    </Card>
  );
}

function ReportLine({
  label,
  value,
  strong = false,
}: Readonly<{ label: string; value: number; strong?: boolean }>) {
  return (
    <div className={cn('flex items-center justify-between gap-4', strong && 'border-t border-[var(--admin-color-border)] pt-3')}>
      <dt className={cn('text-[var(--admin-color-muted)]', strong && 'font-bold text-[var(--admin-color-ink)]')}>{label}</dt>
      <dd className={cn('font-bold tabular-nums', value < 0 && 'text-[var(--admin-color-danger)]', strong && 'text-base font-black')}>
        {formatAdminToman(value)}
      </dd>
    </div>
  );
}

function SupplierCard({ supplier }: Readonly<{ supplier: FinanceSupplierRow }>) {
  return (
    <article className="rounded-[var(--admin-radius-lg)] border border-[var(--admin-color-border)] bg-white p-3 shadow-[var(--admin-shadow-sm)]">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-bold">{supplier.supplierName}</h3>
        <Badge tone={signedTone(supplier.netLiabilityToman)}>{formatAdminToman(supplier.netLiabilityToman)}</Badge>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-3 border-y border-[var(--admin-color-border)] py-3 text-xs">
        <SmallStat label="بدهی باز" value={formatAdminToman(supplier.openPayableToman)} />
        <SmallStat label="اعتبار قابل کسر" value={formatAdminToman(supplier.creditOffsetToman)} />
        <SmallStat label="نقد پرداختی دوره" value={formatAdminToman(supplier.totalSupplierCashPaidToman)} />
        <SmallStat label="تسویه‌های دوره" value={formatAdminInteger(supplier.settlementCount)} />
      </dl>
      <ButtonLink href="/supplier-payables" variant="ghost" size="sm" className="mt-2 w-full">
        مشاهده بدهی‌ها
      </ButtonLink>
    </article>
  );
}

const supplierColumns: readonly DataTableColumn<FinanceSupplierRow>[] = [
  { id: 'supplier', header: 'تأمین‌کننده', cell: (row) => <span className="font-bold">{row.supplierName}</span> },
  { id: 'open', header: 'بدهی باز', align: 'end', cell: (row) => formatAdminToman(row.openPayableToman) },
  { id: 'credit', header: 'اعتبار و کسر', align: 'end', cell: (row) => formatAdminToman(row.creditOffsetToman) },
  { id: 'liability', header: 'تعهد خالص', align: 'end', cell: (row) => <Badge tone={signedTone(row.netLiabilityToman)}>{formatAdminToman(row.netLiabilityToman)}</Badge> },
  { id: 'cash', header: 'نقد پرداختی دوره', align: 'end', visibility: 'lg', cell: (row) => formatAdminToman(row.totalSupplierCashPaidToman) },
  { id: 'settlements', header: 'تسویه دوره', align: 'center', visibility: 'lg', cell: (row) => formatAdminInteger(row.settlementCount) },
  { id: 'action', header: '', align: 'end', cell: () => <ButtonLink href="/supplier-payables" variant="ghost" size="sm">جزئیات</ButtonLink> },
];

function SuppliersPanel({ data }: Readonly<{ data: AdminFinancialReportsData }>) {
  const suppliers = data.suppliers.data ?? [];
  return (
    <section aria-labelledby="financial-suppliers-heading" className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="financial-suppliers-heading" className="text-lg font-black">وضعیت مالی تأمین‌کنندگان</h2>
          <p className="mt-1 text-xs leading-6 text-[var(--admin-color-muted)]">
            تعهد و اعتبار، لحظه‌ای است؛ مبالغ پرداختی براساس بازه انتخاب‌شده محاسبه می‌شود.
          </p>
        </div>
        <div className="flex gap-2">
          <ButtonLink href="/supplier-payables" variant="outline" size="sm">بدهی‌ها</ButtonLink>
          <ButtonLink href="/supplier-settlements" variant="outline" size="sm">دوره‌های تسویه</ButtonLink>
        </div>
      </div>
      <ResponsiveDataView
        caption="وضعیت مالی تأمین‌کنندگان"
        mobileLabel="کارت‌های گزارش تأمین‌کنندگان"
        columns={supplierColumns}
        rows={suppliers}
        getRowKey={(row) => row.supplierId}
        renderMobileCard={(row) => <SupplierCard supplier={row} />}
        emptyTitle="تأمین‌کننده‌ای در گزارش وجود ندارد"
        emptyDescription="هنوز بدهی، اعتبار یا پرداختی برای تأمین‌کنندگان ثبت نشده است."
        error={data.suppliers.failed ? { description: 'داده تجمیعی تأمین‌کنندگان دریافت نشد.' } : undefined}
      />
    </section>
  );
}

function MissingCostBadges({ costs }: Readonly<{ costs: readonly MissingOrderCostCode[] }>) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {costs.map((cost) => <Badge key={cost} tone="warning">{MISSING_COSTS[cost]}</Badge>)}
    </div>
  );
}

function ReconciliationCard({ row }: Readonly<{ row: FinanceCostReconciliationRow }>) {
  return (
    <article className="rounded-[var(--admin-radius-lg)] border border-[var(--admin-color-border)] bg-white p-3 shadow-[var(--admin-shadow-sm)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[0.6875rem] text-[var(--admin-color-muted)]">سفارش</p>
          <h3 className="mt-1 font-black">{row.orderNumber}</h3>
        </div>
        <Badge tone="danger">{formatAdminInteger(row.missingCosts.length)} هزینه ناقص</Badge>
      </div>
      <div className="mt-3 border-y border-[var(--admin-color-border)] py-3"><MissingCostBadges costs={row.missingCosts} /></div>
      <p className="mt-3 text-xs text-[var(--admin-color-muted)]">پرداخت: {row.paidAt ? formatAdminDateTime(row.paidAt) : 'ثبت نشده'}</p>
      <ButtonLink href="/orders" variant="ghost" size="sm" className="mt-2 w-full">رفتن به سفارش‌ها</ButtonLink>
    </article>
  );
}

const reconciliationColumns: readonly DataTableColumn<FinanceCostReconciliationRow>[] = [
  { id: 'order', header: 'سفارش', cell: (row) => <div><p className="font-black">{row.orderNumber}</p><p className="mt-1 text-xs text-[var(--admin-color-muted)]">{row.orderStatus}</p></div> },
  { id: 'paidAt', header: 'زمان پرداخت', visibility: 'md', cell: (row) => row.paidAt ? formatAdminDateTime(row.paidAt) : '—' },
  { id: 'missing', header: 'هزینه‌های ثبت‌نشده', cell: (row) => <MissingCostBadges costs={row.missingCosts} /> },
  { id: 'snapshot', header: 'Snapshot مالی', visibility: 'lg', cell: (row) => <Badge tone={row.financeSnapshotReady ? 'success' : 'danger'}>{row.financeSnapshotReady ? 'آماده' : 'ناقص'}</Badge> },
  { id: 'action', header: '', align: 'end', cell: () => <ButtonLink href="/orders" variant="ghost" size="sm">بررسی سفارش‌ها</ButtonLink> },
];

function ReconciliationPanel({ data }: Readonly<{ data: AdminFinancialReportsData }>) {
  const report = data.reconciliation.data;
  return (
    <section aria-labelledby="cost-reconciliation-heading" className="space-y-3">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="cost-reconciliation-heading" className="text-lg font-black">کنترل ثبت هزینه سفارش</h2>
            {report ? <Badge tone={report.count > 0 ? 'warning' : 'success'}>{formatAdminInteger(report.count)} سفارش نیازمند بررسی</Badge> : null}
          </div>
          <p className="mt-1 text-xs leading-6 text-[var(--admin-color-muted)]">
            سفارش‌های پرداخت‌شده‌ای که هزینه درگاه، ارسال یا آبکاری آن‌ها هنوز ثبت نشده است.
          </p>
        </div>
      </div>
      <ResponsiveDataView
        caption="سفارش‌های دارای هزینه ثبت‌نشده"
        mobileLabel="کارت‌های مغایرت هزینه سفارش"
        columns={reconciliationColumns}
        rows={report?.orders ?? []}
        getRowKey={(row) => row.orderId}
        renderMobileCard={(row) => <ReconciliationCard row={row} />}
        emptyTitle="هزینه‌های سفارش‌ها کامل است"
        emptyDescription="در بازه انتخاب‌شده سفارش پرداخت‌شده‌ای با هزینه ثبت‌نشده پیدا نشد."
        error={data.reconciliation.failed ? { description: 'فهرست کنترل هزینه سفارش‌ها دریافت نشد.' } : undefined}
      />
    </section>
  );
}

export function FinancialReportsView({ data }: Readonly<{ data: AdminFinancialReportsData }>) {
  const management = data.management.data;
  const contribution = data.contribution.data;
  const periodLabel = PERIODS.find((period) => period.value === data.range.period)?.description;
  const hasPartialFailure = [data.management, data.cashflow, data.contribution, data.suppliers, data.reconciliation].some((resource) => resource.failed);

  return (
    <main className="admin-container py-6 sm:py-8 lg:py-10">
      <header className="flex flex-col gap-4 border-b border-[var(--admin-color-border)] pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="info">مرحله {formatAdminInteger(31)}</Badge>
            <Badge tone="neutral">{periodLabel}</Badge>
          </div>
          <h1 className="mt-3 text-2xl font-black sm:text-3xl">گزارش‌های مالی</h1>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--admin-color-muted)]">
            جریان نقدی، سود مشارکت، هزینه‌های سفارش و وضعیت تعهد تأمین‌کنندگان را از یک نمای خواندنی بررسی کنید.
          </p>
        </div>
        <PeriodSelector period={data.range.period} />
      </header>

      <div className="space-y-6 pt-6">
        {hasPartialFailure ? (
          <Alert tone="warning" title="گزارش با داده ناقص نمایش داده شده است">
            یک یا چند منبع مالی پاسخ معتبر نداده‌اند. بخش‌های در دسترس مستقل نمایش داده شده‌اند؛ برای تصمیم مالی ابتدا صفحه را دوباره بارگذاری کنید.
          </Alert>
        ) : null}

        <section aria-label="شاخص‌های کلیدی مالی" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            title="دریافت خالص مشتری"
            value={management ? formatAdminToman(management.customerNetCollectedToman) : '—'}
            description={management ? `${formatAdminInteger(management.paidOrderCount)} سفارش پرداخت‌شده` : 'داده در دسترس نیست'}
            icon="finance"
            tone="success"
          />
          <KpiCard
            title="مشارکت پس از هزینه و بازپرداخت"
            value={contribution ? formatAdminToman(contribution.contributionAfterRefundsToman) : '—'}
            description={contribution ? `${formatAdminInteger(contribution.costEntryCount)} رکورد هزینه` : 'داده در دسترس نیست'}
            icon="pulse"
            tone={contribution && contribution.contributionAfterRefundsToman < 0 ? 'danger' : 'primary'}
          />
          <KpiCard
            title="جریان نقد عملیاتی"
            value={management ? formatAdminToman(management.netOperatingCashflowToman) : '—'}
            description="دریافت مشتری منهای بازپرداخت و پرداخت تأمین"
            icon="finance"
            tone={management && management.netOperatingCashflowToman < 0 ? 'danger' : 'success'}
          />
          <KpiCard
            title="تعهد خالص تأمین‌کنندگان"
            value={management ? formatAdminToman(management.supplierPosition.netLiabilityToman) : '—'}
            description="وضعیت لحظه‌ای بدهی پس از کسر اعتبار"
            icon="suppliers"
            tone="warning"
          />
        </section>

        <section aria-label="تحلیل جریان نقد و سود" className="grid gap-4 xl:grid-cols-2">
          <CashflowPanel data={data} />
          <ContributionPanel data={data} />
        </section>

        <SuppliersPanel data={data} />
        <ReconciliationPanel data={data} />

        <footer className="flex flex-col gap-1 border-t border-[var(--admin-color-border)] pt-4 text-xs text-[var(--admin-color-subtle)] sm:flex-row sm:items-center sm:justify-between">
          <p>مبالغ بر حسب تومان و از snapshotهای قطعی مالی محاسبه شده‌اند.</p>
          <p>آخرین محاسبه: {formatAdminDateTime(data.generatedAt)}</p>
        </footer>
      </div>
    </main>
  );
}
