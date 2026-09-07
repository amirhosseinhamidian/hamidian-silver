import Link from 'next/link';
import type { ReactNode } from 'react';

import { AdminIcon, type AdminIconName } from '@/components/layout/admin-icon';
import { Alert } from '@/components/ui/alert';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { BottomSheetClose } from '@/components/ui/bottom-sheet';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { DataTableColumn } from '@/components/ui/data-table';
import { DonutChart } from '@/components/ui/donut-chart';
import { MobileDataCard } from '@/components/ui/mobile-data-card';
import { ResponsiveDataView } from '@/components/ui/responsive-data-view';
import type { AdminDashboardData } from '@/lib/dashboard/dashboard-data';
import type {
  DashboardOrder,
  DashboardOrderStatus,
  DashboardPeriod,
  DashboardWorkItem,
} from '@/lib/dashboard/dashboard-model';
import {
  formatAdminDateTime,
  formatAdminInteger,
  formatAdminPhone,
  formatAdminToman,
  toPersianDigits,
} from '@/lib/presentation/formatters';
import { cn } from '@/lib/ui/cn';

const periodPresentation: Record<DashboardPeriod, { label: string; description: string }> = {
  '24h': { label: '۲۴ ساعت', description: '۲۴ ساعت اخیر' },
  '7d': { label: '۷ روز', description: '۷ روز اخیر' },
  '30d': { label: '۳۰ روز', description: '۳۰ روز اخیر' },
};

const orderStatusPresentation: Record<DashboardOrderStatus, { label: string; tone: BadgeTone }> = {
  PENDING_PAYMENT: { label: 'در انتظار پرداخت', tone: 'warning' },
  PAID: { label: 'پرداخت‌شده', tone: 'info' },
  PROCESSING: { label: 'در حال پردازش', tone: 'info' },
  SHIPPED: { label: 'ارسال‌شده', tone: 'neutral' },
  DELIVERED: { label: 'تحویل‌شده', tone: 'success' },
  CANCELLED: { label: 'لغوشده', tone: 'danger' },
  EXPIRED: { label: 'منقضی‌شده', tone: 'neutral' },
};

const workCodeLabels: Readonly<Record<string, string>> = {
  PLATING_NOT_STARTED: 'آبکاری شروع نشده',
  PLATING_IN_PROGRESS: 'آبکاری در حال انجام',
  PLATING_OVERDUE: 'آبکاری خارج از SLA',
  PLATING_CANCELLED: 'آبکاری لغوشده',
  SHIPPING_NOT_SELECTED: 'روش ارسال انتخاب نشده',
  READY_FOR_SHIPMENT_CREATION: 'آماده ساخت مرسوله',
  SHIPMENT_CREATION_IN_PROGRESS: 'ساخت مرسوله در حال انجام',
  SHIPMENT_CREATION_STALE: 'ساخت مرسوله متوقف‌شده',
  SHIPMENT_PROVIDER_RECONCILIATION_REQUIRED: 'نیازمند تطبیق با سرویس ارسال',
  READY_FOR_HANDOFF: 'آماده تحویل به ارسال‌کننده',
};

const priorityPresentation: Record<
  DashboardWorkItem['priority'],
  { label: string; tone: BadgeTone }
> = {
  CRITICAL: { label: 'بحرانی', tone: 'danger' },
  HIGH: { label: 'بالا', tone: 'warning' },
  MEDIUM: { label: 'متوسط', tone: 'info' },
  NORMAL: { label: 'عادی', tone: 'neutral' },
};

function KpiCard({
  title,
  value,
  description,
  icon,
  href,
  tone = 'primary',
}: Readonly<{
  title: string;
  value: ReactNode;
  description: string;
  icon: AdminIconName;
  href?: string;
  tone?: 'primary' | 'danger' | 'warning' | 'success';
}>) {
  const toneClassName = {
    primary: 'bg-blue-50 text-blue-700',
    danger: 'bg-red-50 text-red-700',
    warning: 'bg-amber-50 text-amber-700',
    success: 'bg-emerald-50 text-emerald-700',
  }[tone];

  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span className={cn('grid size-9 place-items-center rounded-lg', toneClassName)}>
          <AdminIcon name={icon} className="size-5" />
        </span>
        {href ? (
          <AdminIcon
            name="chevron-left"
            className="size-4 text-[var(--admin-color-subtle)] transition-transform group-hover:-translate-x-0.5"
          />
        ) : null}
      </div>
      <p className="mt-4 text-xs font-semibold text-[var(--admin-color-muted)]">{title}</p>
      <div className="mt-1 min-h-9 text-lg leading-8 font-black break-words tabular-nums text-[var(--admin-color-ink)] sm:text-xl">
        {value}
      </div>
      <p className="mt-1 truncate text-[0.6875rem] text-[var(--admin-color-subtle)]">
        {description}
      </p>
    </>
  );

  const className = cn(
    'group rounded-[var(--admin-radius-lg)] border border-[var(--admin-color-border)] bg-[var(--admin-color-surface)] p-4 shadow-[var(--admin-shadow-sm)]',
    href &&
      'outline-none transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-[var(--admin-color-border-strong)] hover:shadow-[var(--admin-shadow-md)] focus-visible:shadow-[var(--admin-focus-ring)]',
  );

  return href ? (
    <Link href={href} className={className}>
      {content}
    </Link>
  ) : (
    <article className={className}>{content}</article>
  );
}

function PeriodSelector({ period }: Readonly<{ period: DashboardPeriod }>) {
  return (
    <nav
      aria-label="بازه زمانی داشبورد"
      className="inline-flex rounded-lg border border-[var(--admin-color-border)] bg-white p-1"
    >
      {(Object.keys(periodPresentation) as DashboardPeriod[]).map((option) => (
        <Link
          key={option}
          href={`/?period=${option}`}
          aria-current={option === period ? 'page' : undefined}
          className={cn(
            'rounded-md px-3 py-1.5 text-xs font-bold outline-none transition-colors focus-visible:shadow-[var(--admin-focus-ring)]',
            option === period
              ? 'bg-[var(--admin-color-ink)] text-white!'
              : 'text-[var(--admin-color-muted)] hover:bg-[var(--admin-color-surface-hover)] hover:text-[var(--admin-color-ink)]',
          )}
        >
          {periodPresentation[option].label}
        </Link>
      ))}
    </nav>
  );
}

function OperationalSummary({ data }: Readonly<{ data: AdminDashboardData }>) {
  const operations = data.operations.data;

  return (
    <Card
      title="وضعیت صف عملیات"
      description="نمای لحظه‌ای آماده، مسدود و خارج از SLA"
      action={
        <ButtonLink href="/fulfillment" variant="ghost" size="sm">
          مشاهده صف
        </ButtonLink>
      }
    >
      {operations ? (
        <div className="space-y-5">
          <DonutChart
            title="توزیع صف عملیات"
            centerLabel="فعالیت باز"
            segments={[
              {
                label: 'آماده اقدام',
                value: operations.ready,
                color: 'var(--admin-color-success)',
              },
              {
                label: 'مسدود',
                value: operations.blocked,
                color: 'var(--admin-color-warning)',
              },
              {
                label: 'خارج از SLA',
                value: operations.overdue,
                color: 'var(--admin-color-danger)',
              },
            ]}
          />
          <div className="grid grid-cols-2 gap-2 border-t border-[var(--admin-color-border)] pt-4">
            <SmallStat label="آبکاری در انتظار" value={operations.platingPending} />
            <SmallStat label="آماده ساخت مرسوله" value={operations.shipmentReady} />
            <SmallStat label="آبکاری فعال" value={operations.platingInProgress} />
            <SmallStat label="آماده تحویل" value={operations.shipmentReadyForHandoff} />
          </div>
        </div>
      ) : (
        <SectionUnavailable />
      )}
    </Card>
  );
}

function SmallStat({ label, value }: Readonly<{ label: string; value: number }>) {
  return (
    <div className="rounded-lg bg-[var(--admin-color-surface-subtle)] p-3">
      <p className="text-[0.6875rem] leading-5 text-[var(--admin-color-muted)]">{label}</p>
      <p className="mt-1 text-lg font-black tabular-nums">{formatAdminInteger(value)}</p>
    </div>
  );
}

function InventorySummary({ data }: Readonly<{ data: AdminDashboardData }>) {
  const inventory = data.inventory.data;

  return (
    <Card
      title="سلامت موجودی"
      description="خلاصه موجودی قابل فروش و رزرو"
      action={
        <ButtonLink href="/inventory" variant="ghost" size="sm">
          انبار
        </ButtonLink>
      }
    >
      {inventory ? (
        <div className="grid grid-cols-2 gap-2">
          <SmallStat label="موجودی قابل فروش" value={inventory.availableUnits} />
          <SmallStat label="واحد رزروشده" value={inventory.reservedUnits} />
          <div className="rounded-lg bg-amber-50 p-3 text-amber-800">
            <p className="text-[0.6875rem] leading-5">تنوع کم‌موجود</p>
            <p className="mt-1 text-lg font-black tabular-nums">
              {formatAdminInteger(inventory.lowStockCount)}
            </p>
          </div>
          <div className="rounded-lg bg-red-50 p-3 text-red-800">
            <p className="text-[0.6875rem] leading-5">تنوع ناموجود</p>
            <p className="mt-1 text-lg font-black tabular-nums">
              {formatAdminInteger(inventory.outOfStockCount)}
            </p>
          </div>
        </div>
      ) : (
        <SectionUnavailable />
      )}
    </Card>
  );
}

function formatWorkAge(minutes: number | null): string {
  if (minutes === null) return 'زمان نامشخص';
  if (minutes < 60) return `${formatAdminInteger(Math.max(0, Math.floor(minutes)))} دقیقه`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${formatAdminInteger(hours)} ساعت`;
  return `${formatAdminInteger(Math.floor(hours / 24))} روز`;
}

function PriorityWork({ data }: Readonly<{ data: AdminDashboardData }>) {
  const items = data.priorityWork.data;

  return (
    <Card
      title="اقدامات اولویت‌دار"
      description="صف مرتب‌شده براساس شدت و زمان انتظار"
      action={
        <Badge tone={items?.length ? 'warning' : 'success'}>
          {items?.length === 6
            ? `${formatAdminInteger(6)} مورد نخست`
            : `${formatAdminInteger(items?.length ?? 0)} مورد`}
        </Badge>
      }
    >
      {items === null ? (
        <SectionUnavailable />
      ) : items.length === 0 ? (
        <div className="grid min-h-40 place-items-center text-center">
          <div>
            <span className="mx-auto grid size-10 place-items-center rounded-full bg-emerald-50 text-emerald-700">
              <AdminIcon name="pulse" />
            </span>
            <p className="mt-3 text-sm font-bold">صف اقدام فوری خالی است</p>
            <p className="mt-1 text-xs text-[var(--admin-color-muted)]">
              در حال حاضر مورد معوق یا مسدودی ثبت نشده است.
            </p>
          </div>
        </div>
      ) : (
        <ul className="divide-y divide-[var(--admin-color-border)]">
          {items.map((item) => {
            const priority = priorityPresentation[item.priority];
            const href = item.workType === 'PLATING' ? '/plating' : '/fulfillment';

            return (
              <li key={`${item.orderId}-${item.code}`}>
                <Link
                  href={href}
                  className="group flex items-center gap-3 rounded-lg px-1 py-3 outline-none transition-colors hover:bg-[var(--admin-color-surface-hover)] focus-visible:shadow-[var(--admin-focus-ring)] sm:px-2"
                >
                  <span
                    className={cn(
                      'grid size-9 shrink-0 place-items-center rounded-lg',
                      item.workType === 'PLATING'
                        ? 'bg-violet-50 text-violet-700'
                        : 'bg-blue-50 text-blue-700',
                    )}
                  >
                    <AdminIcon name={item.workType === 'PLATING' ? 'plating' : 'fulfillment'} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-bold">
                        {workCodeLabels[item.code] ?? 'عملیات نیازمند بررسی'}
                      </span>
                      <Badge tone={priority.tone}>{priority.label}</Badge>
                    </span>
                    <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[0.6875rem] text-[var(--admin-color-muted)]">
                      <span dir="ltr">{toPersianDigits(item.orderNumber)}</span>
                      <span>{formatWorkAge(item.ageMinutes)} در صف</span>
                    </span>
                  </span>
                  <AdminIcon
                    name="chevron-left"
                    className="size-4 shrink-0 text-[var(--admin-color-subtle)] transition-transform group-hover:-translate-x-0.5"
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function SectionUnavailable() {
  return (
    <div className="grid min-h-32 place-items-center rounded-lg border border-dashed border-[var(--admin-color-border)] bg-[var(--admin-color-surface-subtle)] p-4 text-center">
      <div>
        <p className="text-sm font-bold">اطلاعات دریافت نشد</p>
        <p className="mt-1 text-xs text-[var(--admin-color-muted)]">
          اتصال API را بررسی و صفحه را تازه کنید.
        </p>
      </div>
    </div>
  );
}

function OrderDetail({
  label,
  value,
  direction,
}: Readonly<{ label: string; value: ReactNode; direction?: 'rtl' | 'ltr' }>) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <dt className="text-xs text-[var(--admin-color-muted)]">{label}</dt>
      <dd className="text-end text-sm font-semibold" dir={direction}>
        {value}
      </dd>
    </div>
  );
}

function RecentOrderMobileCard({ order }: Readonly<{ order: DashboardOrder }>) {
  const status = orderStatusPresentation[order.status];
  const customer = order.customerName ?? formatAdminPhone(order.customerPhone);

  return (
    <MobileDataCard
      eyebrow={<span dir="ltr">{toPersianDigits(order.orderNumber)}</span>}
      title={customer}
      status={
        <Badge tone={status.tone} dot>
          {status.label}
        </Badge>
      }
      items={[
        { label: 'مبلغ', value: formatAdminToman(order.grandTotalToman) },
        { label: 'تعداد اقلام', value: formatAdminInteger(order.itemCount) },
      ]}
      detailsTitle={`سفارش ${toPersianDigits(order.orderNumber)}`}
      detailsDescription="خلاصه اطلاعات سفارش؛ عملیات کامل در بخش سفارش‌ها در دسترس است."
      details={
        <dl className="divide-y divide-[var(--admin-color-border)]">
          <OrderDetail label="مشتری" value={customer} />
          <OrderDetail
            label="شماره همراه"
            value={formatAdminPhone(order.customerPhone)}
            direction="ltr"
          />
          <OrderDetail label="زمان ثبت" value={formatAdminDateTime(order.createdAt)} />
          <OrderDetail label="مبلغ" value={formatAdminToman(order.grandTotalToman)} />
          <OrderDetail label="تعداد اقلام" value={formatAdminInteger(order.itemCount)} />
          <OrderDetail
            label="وضعیت"
            value={
              <Badge tone={status.tone} dot>
                {status.label}
              </Badge>
            }
          />
        </dl>
      }
      detailsFooter={
        <>
          <BottomSheetClose asChild>
            <Button variant="outline">بستن</Button>
          </BottomSheetClose>
          <ButtonLink href="/orders">رفتن به سفارش‌ها</ButtonLink>
        </>
      }
    />
  );
}

const recentOrderColumns: readonly DataTableColumn<DashboardOrder>[] = [
  {
    id: 'order',
    header: 'سفارش',
    cell: (order) => (
      <span dir="ltr" className="font-black">
        {toPersianDigits(order.orderNumber)}
      </span>
    ),
  },
  {
    id: 'customer',
    header: 'مشتری',
    cell: (order) => (
      <div>
        <p className="font-semibold">{order.customerName ?? 'بدون نام'}</p>
        <p dir="ltr" className="mt-1 text-xs text-[var(--admin-color-muted)]">
          {formatAdminPhone(order.customerPhone)}
        </p>
      </div>
    ),
  },
  {
    id: 'createdAt',
    header: 'زمان ثبت',
    visibility: 'lg',
    cell: (order) => (
      <span className="whitespace-nowrap text-[var(--admin-color-muted)]">
        {formatAdminDateTime(order.createdAt)}
      </span>
    ),
  },
  {
    id: 'amount',
    header: 'مبلغ',
    visibility: 'sm',
    cell: (order) => (
      <span className="whitespace-nowrap font-bold">{formatAdminToman(order.grandTotalToman)}</span>
    ),
  },
  {
    id: 'status',
    header: 'وضعیت',
    cell: (order) => {
      const status = orderStatusPresentation[order.status];
      return (
        <Badge tone={status.tone} dot>
          {status.label}
        </Badge>
      );
    },
  },
];

function RecentOrders({ data }: Readonly<{ data: AdminDashboardData }>) {
  const orders = data.recentOrders.data ?? [];

  return (
    <section aria-labelledby="recent-orders-title" className="mt-6">
      <div className="mb-3 flex items-end justify-between gap-4">
        <div>
          <h2 id="recent-orders-title" className="text-lg font-black">
            سفارش‌های اخیر
          </h2>
          <p className="mt-1 text-xs text-[var(--admin-color-muted)]">
            آخرین سفارش‌های ثبت‌شده در فروشگاه
          </p>
        </div>
        <ButtonLink href="/orders" variant="outline" size="sm">
          همه سفارش‌ها
        </ButtonLink>
      </div>
      <ResponsiveDataView
        mobileLabel="کارت‌های سفارش‌های اخیر"
        renderMobileCard={(order) => <RecentOrderMobileCard order={order} />}
        caption="فهرست سفارش‌های اخیر"
        columns={recentOrderColumns}
        rows={orders}
        getRowKey={(order) => order.id}
        compact
        error={
          data.recentOrders.failed ? { description: 'دریافت سفارش‌های اخیر انجام نشد.' } : undefined
        }
        emptyTitle="هنوز سفارشی ثبت نشده است"
        emptyDescription="پس از ثبت اولین سفارش، خلاصه آن در این قسمت دیده می‌شود."
      />
    </section>
  );
}

export function AdminDashboardView({ data }: Readonly<{ data: AdminDashboardData }>) {
  const finance = data.finance.data;
  const operations = data.operations.data;
  const alerts = data.alerts.data;
  const inventory = data.inventory.data;
  const failedCount = [
    data.finance.failed,
    data.operations.failed,
    data.alerts.failed,
    data.inventory.failed,
    data.recentOrders.failed,
    data.priorityWork.failed,
  ].filter(Boolean).length;
  const financeDescription = data.financeRestricted
    ? 'نیازمند دسترسی مالی'
    : finance
      ? periodPresentation[data.period].description
      : 'داده مالی دریافت نشد';

  return (
    <main className="admin-container py-6 sm:py-8 lg:py-10">
      <header className="flex flex-col gap-5 border-b border-[var(--admin-color-border)] pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-black tracking-wider text-[var(--admin-color-primary)]">
            مرکز عملیات
          </p>
          <h1 className="mt-2 text-2xl font-black sm:text-3xl">داشبورد مدیریتی</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--admin-color-muted)]">
            وضعیت فروش، سفارش و عملیات حساس در یک نمای واحد
          </p>
          <p className="mt-1 text-[0.6875rem] text-[var(--admin-color-subtle)]">
            آخرین دریافت: {formatAdminDateTime(data.generatedAt)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PeriodSelector period={data.period} />
          <ButtonLink href="/orders" leadingIcon={<AdminIcon name="orders" className="size-4" />}>
            عملیات سفارش‌ها
          </ButtonLink>
        </div>
      </header>

      {failedCount > 0 ? (
        <Alert tone="warning" title="بخشی از اطلاعات به‌روز نشد" className="mt-5">
          {formatAdminInteger(failedCount)} بخش از داشبورد پاسخ معتبر دریافت نکرد. سایر بخش‌ها مستقل
          و قابل استفاده هستند.
        </Alert>
      ) : null}

      <section
        aria-label="شاخص‌های کلیدی"
        className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5"
      >
        <KpiCard
          title="فروش قطعی"
          value={
            data.financeRestricted
              ? 'محدود'
              : finance
                ? formatAdminInteger(finance.paidOrderCount)
                : '—'
          }
          description={
            finance && !data.financeRestricted
              ? `${formatAdminToman(finance.grossSalesToman)} فروش ناخالص`
              : financeDescription
          }
          icon="orders"
          href={data.financeRestricted ? undefined : '/finance'}
          tone="success"
        />
        <KpiCard
          title="درآمد خالص دریافتی"
          value={
            data.financeRestricted
              ? 'محدود'
              : finance
                ? formatAdminToman(finance.netCollectedRevenueToman)
                : '—'
          }
          description={financeDescription}
          icon="finance"
          href={data.financeRestricted ? undefined : '/finance'}
        />
        <KpiCard
          title="سفارش در صف عملیات"
          value={operations ? formatAdminInteger(operations.uniqueOrderCount) : '—'}
          description={
            operations
              ? `${formatAdminInteger(operations.total)} فعالیت باز`
              : 'داده عملیاتی دریافت نشد'
          }
          icon="fulfillment"
          href="/fulfillment"
          tone={operations?.overdue ? 'warning' : 'primary'}
        />
        <KpiCard
          title="هشدار فعال"
          value={alerts ? formatAdminInteger(alerts.activeIncidentCount) : '—'}
          description={
            alerts ? `${formatAdminInteger(alerts.critical)} مورد بحرانی` : 'داده هشدار دریافت نشد'
          }
          icon="alerts"
          href="/alerts"
          tone={alerts?.activeIncidentCount ? 'danger' : 'success'}
        />
        <KpiCard
          title="تنوع کم‌موجود"
          value={inventory ? formatAdminInteger(inventory.lowStockCount) : '—'}
          description={
            inventory
              ? `${formatAdminInteger(inventory.outOfStockCount)} تنوع ناموجود`
              : 'داده موجودی دریافت نشد'
          }
          icon="inventory"
          href="/inventory"
          tone={inventory?.lowStockCount ? 'warning' : 'success'}
        />
      </section>

      <div className="mt-6 grid items-start gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(20rem,0.75fr)]">
        <PriorityWork data={data} />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
          <OperationalSummary data={data} />
          <InventorySummary data={data} />
        </div>
      </div>

      <RecentOrders data={data} />
    </main>
  );
}
