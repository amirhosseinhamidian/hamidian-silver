'use client';

import { useMemo, useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { DataTableColumn } from '@/components/ui/data-table';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { DonutChart } from '@/components/ui/donut-chart';
import { FilterBar, SearchField } from '@/components/ui/filter-bar';
import { MobileDataCard } from '@/components/ui/mobile-data-card';
import { ResponsiveDataView } from '@/components/ui/responsive-data-view';
import { Select } from '@/components/ui/select';
import type {
  AuditChangeValue,
  AuditLogItem,
  AuditLogSnapshot,
  AuditOperationType,
  AuditOutcome,
} from '@/lib/audit-log/audit-log-model';
import {
  formatAdminDateTime,
  formatAdminInteger,
  formatAdminPhone,
  toAsciiDigits,
  toPersianDigits,
} from '@/lib/presentation/formatters';

type Props = Readonly<{ snapshot: AuditLogSnapshot | null; failed: boolean }>;
type OutcomeFilter = 'all' | AuditOutcome;
type OperationFilter = 'all' | AuditOperationType;
type DetailMode = 'desktop' | 'mobile' | null;

const OUTCOME: Record<AuditOutcome, Readonly<{ label: string; tone: BadgeTone }>> = {
  SUCCESS: { label: 'موفق', tone: 'success' },
  FAILURE: { label: 'ناموفق', tone: 'danger' },
};

const OPERATION_LABELS: Readonly<Record<AuditOperationType, string>> = {
  CREATE: 'ایجاد',
  UPDATE: 'ویرایش',
  DELETE: 'حذف',
  PRICE_CHANGE: 'تغییر قیمت',
  STATUS_CHANGE: 'تغییر وضعیت',
  STOCK_ADJUSTMENT: 'اصلاح موجودی',
  PERMISSION_CHANGE: 'تغییر دسترسی',
};

const ORDER_STATUS_LABELS: Readonly<Record<string, string>> = {
  PENDING_PAYMENT: 'در انتظار پرداخت',
  PAID: 'پرداخت‌شده',
  PROCESSING: 'آماده‌سازی',
  SHIPPED: 'ارسال‌شده',
  DELIVERED: 'تحویل‌شده',
  CANCELLED: 'لغوشده',
};

const RESOURCE_LABELS: Readonly<Record<string, string>> = {
  orders: 'سفارش‌ها',
  finance: 'مالی',
  inventory: 'موجودی',
  pricing: 'قیمت‌گذاری',
  payments: 'پرداخت',
  'site-settings': 'تنظیمات سایت',
  users: 'کاربران',
  roles: 'نقش‌ها',
  notifications: 'اعلان‌ها',
  catalog: 'کاتالوگ',
  'admin-roles': 'نقش‌ها و دسترسی‌ها',
};

function resourceLabel(resource: string): string {
  return RESOURCE_LABELS[resource] ?? resource.replaceAll('-', ' ');
}

function OutcomeBadge({ outcome }: Readonly<{ outcome: AuditOutcome }>) {
  const meta = OUTCOME[outcome];
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

function actorLabel(item: AuditLogItem): string {
  return item.actor.name ?? formatAdminPhone(item.actor.phone);
}

function roleCodes(item: AuditLogItem): string {
  const roles = item.metadata?.roleCodes;
  return Array.isArray(roles) && roles.every((role) => typeof role === 'string')
    ? roles.join('، ')
    : 'ثبت نشده';
}

function changeValue(field: string, value: AuditChangeValue): string {
  if (value === null) return 'ثبت نشده';
  if (typeof value === 'object') return value.length ? value.join('، ') : 'بدون مورد';
  if (typeof value === 'boolean') return value ? 'بله' : 'خیر';
  if (typeof value === 'number') return formatAdminInteger(value);
  return field === 'status' ? (ORDER_STATUS_LABELS[value] ?? value) : value;
}

function DetailRows({ rows }: Readonly<{ rows: readonly (readonly [string, string])[] }>) {
  return (
    <dl className="divide-y divide-[var(--admin-color-border)]">
      {rows.map(([label, value]) => (
        <div key={label} className="flex justify-between gap-4 py-2.5 text-xs sm:text-sm">
          <dt className="text-[var(--admin-color-muted)]">{label}</dt>
          <dd className="max-w-[68%] text-left font-semibold break-words" dir="auto">
            {toPersianDigits(value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function AuditDetails({ item }: Readonly<{ item: AuditLogItem }>) {
  return (
    <div className="space-y-4">
      {item.outcome === 'FAILURE' ? (
        <Alert tone="danger" title="عملیات ناموفق ثبت شده است">
          برای حفظ محرمانگی، متن خطا و محتوای درخواست در Audit Log ذخیره نشده‌اند.
        </Alert>
      ) : null}
      <Card title="شرح عملیات">
        <DetailRows
          rows={[
            ['عنوان', item.title],
            ['نتیجه', OUTCOME[item.outcome].label],
            ['نوع عملیات', OPERATION_LABELS[item.operationType]],
            ['موجودیت', item.entityName ?? resourceLabel(item.resource)],
            ['بخش مرتبط', resourceLabel(item.resource)],
            ['زمان ثبت', formatAdminDateTime(item.createdAt)],
          ]}
        />
      </Card>
      {item.changes.length ? (
        <Card title="تغییرات مهم">
          <div className="space-y-3">
            {item.changes.map((change) => (
              <div
                key={change.field}
                className="rounded-[var(--admin-radius-md)] border border-[var(--admin-color-border)] p-3"
              >
                <p className="text-sm font-bold">{change.label}</p>
                <DetailRows
                  rows={[
                    ['قبل', changeValue(change.field, change.before)],
                    ['بعد', changeValue(change.field, change.after)],
                  ]}
                />
              </div>
            ))}
          </div>
        </Card>
      ) : null}
      <Card title="اطلاعات فنی">
        <DetailRows
          rows={[
            ['Action فنی', item.action],
            ['مسیر درخواست', item.path],
            ['شناسه موجودیت', item.resourceId ?? 'ندارد'],
            ['کد وضعیت', formatAdminInteger(item.statusCode)],
            ['زمان پاسخ', `${formatAdminInteger(item.durationMs)} میلی‌ثانیه`],
          ]}
        />
      </Card>
      <Card title="عامل و درخواست">
        <DetailRows
          rows={[
            ['مدیر', actorLabel(item)],
            ['شماره مدیر', formatAdminPhone(item.actor.phone)],
            ['نقش هنگام اقدام', roleCodes(item)],
            ['شناسه درخواست', item.requestId ?? 'ثبت نشده'],
            ['نشانی شبکه', item.ipAddress ?? 'ثبت نشده'],
            ['User Agent', item.userAgent ?? 'ثبت نشده'],
          ]}
        />
      </Card>
    </div>
  );
}

export function AuditLogView({ snapshot, failed }: Props) {
  const [search, setSearch] = useState('');
  const [outcome, setOutcome] = useState<OutcomeFilter>('all');
  const [operation, setOperation] = useState<OperationFilter>('all');
  const [resource, setResource] = useState('all');
  const [selected, setSelected] = useState<AuditLogItem | null>(null);
  const [detailMode, setDetailMode] = useState<DetailMode>(null);
  const needle = toAsciiDigits(search).trim().toLocaleLowerCase('fa');

  const filtered = useMemo(
    () =>
      (snapshot?.items ?? []).filter((item) => {
        if (outcome !== 'all' && item.outcome !== outcome) return false;
        if (operation !== 'all' && item.operationType !== operation) return false;
        if (resource !== 'all' && item.resource !== resource) return false;
        if (!needle) return true;
        return [
          item.title,
          item.entityName ?? '',
          item.action,
          item.path,
          item.resourceId ?? '',
          item.requestId ?? '',
          item.actor.phone,
          item.actor.name ?? '',
        ].some((value) => toAsciiDigits(value).toLocaleLowerCase('fa').includes(needle));
      }),
    [needle, operation, outcome, resource, snapshot],
  );

  function openDetails(item: AuditLogItem, mode: Exclude<DetailMode, null>) {
    setSelected(item);
    setDetailMode(mode);
  }

  function closeDetails() {
    setSelected(null);
    setDetailMode(null);
  }

  if (failed || !snapshot)
    return (
      <Alert tone="danger" title="Audit Log دریافت نشد">
        migration پایگاه داده، اتصال API و مجوز `audit.read` را بررسی کنید.
      </Alert>
    );

  const columns: readonly DataTableColumn<AuditLogItem>[] = [
    {
      id: 'action',
      header: 'عملیات',
      cell: (item) => (
        <div>
          <p className="max-w-80 font-bold break-words">{toPersianDigits(item.title)}</p>
          <p className="mt-1 text-xs text-[var(--admin-color-muted)]">
            {OPERATION_LABELS[item.operationType]} · {resourceLabel(item.resource)}
          </p>
          <p className="mt-1 max-w-72 text-[0.68rem] text-[var(--admin-color-subtle)]" dir="ltr">
            {item.action}
          </p>
        </div>
      ),
    },
    { id: 'outcome', header: 'نتیجه', cell: (item) => <OutcomeBadge outcome={item.outcome} /> },
    {
      id: 'actor',
      header: 'عامل',
      cell: (item) => (
        <div>
          <p className="font-semibold">{actorLabel(item)}</p>
          <p className="mt-1 text-xs text-[var(--admin-color-muted)]">
            {formatAdminPhone(item.actor.phone)}
          </p>
        </div>
      ),
    },
    {
      id: 'status',
      header: 'HTTP / زمان',
      visibility: 'lg',
      cell: (item) =>
        `${formatAdminInteger(item.statusCode)} · ${formatAdminInteger(item.durationMs)}ms`,
    },
    {
      id: 'created',
      header: 'زمان',
      visibility: 'lg',
      cell: (item) => formatAdminDateTime(item.createdAt),
    },
    {
      id: 'actions',
      header: 'جزئیات',
      align: 'end',
      cell: (item) => (
        <Button size="sm" variant="outline" onClick={() => openDetails(item, 'desktop')}>
          مشاهده
        </Button>
      ),
    },
  ];

  const activeFilters =
    Number(Boolean(needle)) +
    Number(outcome !== 'all') +
    Number(operation !== 'all') +
    Number(resource !== 'all');

  return (
    <div className="space-y-6">
      <Alert tone="info">
        این گزارش فقط‌خواندنی و append-only است؛ فقط تغییرات منتخب و غیرحساس ثبت می‌شوند و رمز،
        توکن، اطلاعات درگاه، payload کامل و متن خطا نگهداری نمی‌شود.
      </Alert>
      <section aria-label="شاخص‌های گزارش فعالیت" className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi label="کل رویدادها" value={snapshot.summary.total} tone="neutral" />
        <Kpi label="۲۴ ساعت اخیر" value={snapshot.summary.last24Hours} tone="info" />
        <Kpi label="موفق" value={snapshot.summary.succeeded} tone="success" />
        <Kpi
          label="ناموفق"
          value={snapshot.summary.failed}
          tone={snapshot.summary.failed ? 'danger' : 'neutral'}
        />
        <Kpi label="عامل یکتا" value={snapshot.summary.actors} tone="warning" />
      </section>
      <Card
        title="نتیجه عملیات حساس"
        description={`آخرین دریافت: ${formatAdminDateTime(snapshot.generatedAt)}`}
      >
        <DonutChart
          title="نتیجه Audit Log"
          segments={[
            {
              label: 'موفق',
              value: snapshot.summary.succeeded,
              color: 'var(--admin-color-success)',
            },
            {
              label: 'ناموفق',
              value: snapshot.summary.failed,
              color: 'var(--admin-color-danger)',
            },
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
                setOutcome('all');
                setOperation('all');
                setResource('all');
              }}
            >
              بازنشانی فیلترها
            </Button>
          ) : undefined
        }
      >
        <SearchField
          aria-label="جستجوی گزارش فعالیت"
          placeholder="عملیات، مدیر، شناسه یا مسیر"
          value={search}
          onChange={(event) => setSearch(toPersianDigits(event.target.value))}
        />
        <Select
          aria-label="فیلتر نتیجه عملیات"
          value={outcome}
          onValueChange={(value) => setOutcome(value as OutcomeFilter)}
          options={[
            { value: 'all', label: 'همه نتیجه‌ها' },
            { value: 'SUCCESS', label: 'موفق' },
            { value: 'FAILURE', label: 'ناموفق' },
          ]}
        />
        <Select
          aria-label="فیلتر نوع عملیات"
          value={operation}
          onValueChange={(value) => setOperation(value as OperationFilter)}
          options={[
            { value: 'all', label: 'همه عملیات‌ها' },
            ...snapshot.operationTypes.map((value) => ({
              value,
              label: OPERATION_LABELS[value],
            })),
          ]}
        />
        <Select
          aria-label="فیلتر منبع عملیات"
          value={resource}
          onValueChange={setResource}
          options={[
            { value: 'all', label: 'همه بخش‌ها' },
            ...snapshot.resources.map((value) => ({ value, label: resourceLabel(value) })),
          ]}
        />
      </FilterBar>
      <ResponsiveDataView
        caption="فهرست گزارش فعالیت‌های حساس"
        mobileLabel="کارت‌های گزارش فعالیت"
        columns={columns}
        rows={filtered}
        getRowKey={(item) => item.id}
        emptyTitle="رویدادی پیدا نشد"
        emptyDescription="فیلتر یا عبارت جستجو را تغییر دهید."
        renderMobileCard={(item) => (
          <MobileDataCard
            detailsOpen={detailMode === 'mobile' && selected?.id === item.id}
            onDetailsOpenChange={(open) => (open ? openDetails(item, 'mobile') : closeDetails())}
            title={toPersianDigits(item.title)}
            eyebrow={resourceLabel(item.resource)}
            status={<OutcomeBadge outcome={item.outcome} />}
            items={[
              { label: 'عامل', value: actorLabel(item) },
              { label: 'زمان', value: formatAdminDateTime(item.createdAt) },
              { label: 'کد وضعیت', value: formatAdminInteger(item.statusCode) },
              { label: 'مدت', value: `${formatAdminInteger(item.durationMs)}ms` },
            ]}
            detailsTitle={toPersianDigits(item.title)}
            detailsDescription={`${OPERATION_LABELS[item.operationType]} · ${resourceLabel(item.resource)}`}
            details={<AuditDetails item={item} />}
          />
        )}
      />
      <Dialog open={detailMode === 'desktop'} onOpenChange={(open) => !open && closeDetails()}>
        {selected ? (
          <DialogContent
            size="lg"
            title={toPersianDigits(selected.title)}
            description={`${OPERATION_LABELS[selected.operationType]} · ${resourceLabel(selected.resource)}`}
          >
            <AuditDetails item={selected} />
          </DialogContent>
        ) : null}
      </Dialog>
    </div>
  );
}
