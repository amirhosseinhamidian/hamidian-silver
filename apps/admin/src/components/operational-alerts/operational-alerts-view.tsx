'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { BottomSheet, BottomSheetContent } from '@/components/ui/bottom-sheet';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { DataTableColumn } from '@/components/ui/data-table';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { FilterBar, SearchField } from '@/components/ui/filter-bar';
import { MobileDataCard } from '@/components/ui/mobile-data-card';
import { ResponsiveDataView } from '@/components/ui/responsive-data-view';
import { Select } from '@/components/ui/select';
import {
  OPERATIONAL_ALERT_CODES,
  operationalAlertAgeMinutes,
  operationalAlertEscalated,
  type AdminOperationalAlert,
  type AdminOperationalAlertCode,
  type AdminOperationalAlertPriority,
  type AdminOperationalAlertSummary,
  type AdminOperationalAlertWorkflowStatus,
} from '@/lib/operational-alerts/operational-alerts-model';
import {
  formatAdminDateTime,
  formatAdminInteger,
  formatAdminPhone,
  toAsciiDigits,
  toPersianDigits,
} from '@/lib/presentation/formatters';

type Props = Readonly<{
  alerts: readonly AdminOperationalAlert[];
  summary: AdminOperationalAlertSummary | null;
  failed: boolean;
  canAcknowledge: boolean;
}>;

type StatusFilter = 'all' | AdminOperationalAlertWorkflowStatus;
type CodeFilter = 'all' | AdminOperationalAlertCode;
type EscalationFilter = 'all' | 'escalated' | 'initial';

const WORKFLOW: Record<AdminOperationalAlertWorkflowStatus, { label: string; tone: BadgeTone }> = {
  OPEN: { label: 'تأییدنشده', tone: 'danger' },
  ACKNOWLEDGED: { label: 'دریافت تأیید شد', tone: 'warning' },
  RESOLVED: { label: 'رفع‌شده', tone: 'success' },
};

const PRIORITY: Record<AdminOperationalAlertPriority, { label: string; tone: BadgeTone }> = {
  CRITICAL: { label: 'بحرانی', tone: 'danger' },
  HIGH: { label: 'بالا', tone: 'danger' },
  MEDIUM: { label: 'متوسط', tone: 'warning' },
  NORMAL: { label: 'عادی', tone: 'neutral' },
};

const CODE: Record<AdminOperationalAlertCode, { label: string; description: string }> = {
  PLATING_OVERDUE: {
    label: 'آبکاری معوق',
    description: 'زمان انجام آبکاری از SLA عبور کرده و سفارش نیازمند پیگیری فوری است.',
  },
  PLATING_CANCELLED: {
    label: 'آبکاری لغوشده',
    description: 'آبکاری سفارش لغو شده و مسیر آماده‌سازی تا تصمیم اپراتور مسدود است.',
  },
  SHIPMENT_CREATION_STALE: {
    label: 'ساخت مرسوله متوقف',
    description: 'ساخت مرسوله بیش از زمان مجاز در وضعیت در حال انجام باقی مانده است.',
  },
  SHIPMENT_PROVIDER_RECONCILIATION_REQUIRED: {
    label: 'مغایرت مرسوله',
    description: 'وضعیت داخلی مرسوله و اطلاعات سرویس ارسال نیازمند تطبیق است.',
  },
};

const STATUS_OPTIONS = [
  { value: 'all', label: 'همه وضعیت‌ها' },
  { value: 'OPEN', label: 'تأییدنشده' },
  { value: 'ACKNOWLEDGED', label: 'تأیید دریافت' },
  { value: 'RESOLVED', label: 'رفع‌شده' },
];

const CODE_OPTIONS = [
  { value: 'all', label: 'همه انواع هشدار' },
  ...Object.entries(CODE).map(([value, item]) => ({ value, label: item.label })),
];

const ESCALATION_OPTIONS = [
  { value: 'all', label: 'همه سطوح اعلان' },
  { value: 'escalated', label: 'فقط Escalation' },
  { value: 'initial', label: 'اعلان اولیه' },
];

function WorkflowBadge({ status }: Readonly<{ status: AdminOperationalAlertWorkflowStatus }>) {
  const item = WORKFLOW[status];
  return (
    <Badge tone={item.tone} dot>
      {item.label}
    </Badge>
  );
}

function EscalationBadge({ escalated }: Readonly<{ escalated: boolean }>) {
  return escalated ? (
    <Badge tone="danger" dot>
      Escalation
    </Badge>
  ) : (
    <Badge tone="info">اعلان اولیه</Badge>
  );
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

function AlertTypeChart({ summary }: Readonly<{ summary: AdminOperationalAlertSummary | null }>) {
  const items = summary
    ? OPERATIONAL_ALERT_CODES.map((code) => ({
        code,
        label: CODE[code].label,
        value: summary.byCode[code] ?? 0,
      }))
    : [];
  const maximum = Math.max(1, ...items.map((item) => item.value));
  return (
    <Card title="ترکیب هشدارهای فعال" description="تعداد هشدارها براساس منشأ اختلال">
      {items.length ? (
        <div role="img" aria-label="نمودار انواع هشدار عملیاتی" className="space-y-3">
          {items.map((item) => (
            <div key={item.code}>
              <div className="mb-1 flex justify-between gap-3 text-xs">
                <span className="text-[var(--admin-color-muted)]">{item.label}</span>
                <strong>{formatAdminInteger(item.value)}</strong>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[var(--admin-color-surface-subtle)]">
                <span
                  className="block h-full rounded-full bg-[var(--admin-color-primary)]"
                  style={{ width: `${(item.value / maximum) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-[var(--admin-color-muted)]">خلاصه هشدارها دریافت نشد.</p>
      )}
    </Card>
  );
}

function DeliveryHealth({ summary }: Readonly<{ summary: AdminOperationalAlertSummary | null }>) {
  const delivery = summary?.delivery;
  return (
    <Card title="سلامت ارسال اعلان" description="وضعیت صف پیام‌های هشدار برای مدیران">
      {delivery ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'در انتظار', value: delivery.pending, tone: 'warning' as const },
              { label: 'در حال پردازش', value: delivery.processing, tone: 'info' as const },
              { label: 'ارسال‌شده', value: delivery.sent, tone: 'success' as const },
              { label: 'ناموفق', value: delivery.failed, tone: 'danger' as const },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-[var(--admin-radius-md)] bg-[var(--admin-color-surface-subtle)] p-3 text-center"
              >
                <Badge tone={item.tone}>{item.label}</Badge>
                <p className="mt-2 text-lg font-black">{formatAdminInteger(item.value)}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-[var(--admin-color-subtle)]">
            آخرین پردازش:{' '}
            {delivery.lastProcessedAt ? formatAdminDateTime(delivery.lastProcessedAt) : 'ثبت نشده'}
          </p>
        </>
      ) : (
        <p className="text-sm text-[var(--admin-color-muted)]">وضعیت ارسال اعلان دریافت نشد.</p>
      )}
    </Card>
  );
}

function actorLabel(actor: AdminOperationalAlert['acknowledgedBy']): string {
  if (!actor) return 'ثبت نشده';
  const name = [actor.firstName, actor.lastName].filter(Boolean).join(' ');
  return name || formatAdminPhone(actor.phone);
}

function formatAge(minutes: number): string {
  if (minutes < 60) return `${formatAdminInteger(minutes)} دقیقه`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${formatAdminInteger(hours)} ساعت`;
  return `${formatAdminInteger(Math.floor(hours / 24))} روز`;
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

function alertDestination(alert: AdminOperationalAlert): '/plating' | '/shipping' {
  return alert.code.startsWith('PLATING_') ? '/plating' : '/shipping';
}

function AlertActions({
  alert,
  canAcknowledge,
  onAcknowledge,
}: Readonly<{
  alert: AdminOperationalAlert;
  canAcknowledge: boolean;
  onAcknowledge: (alert: AdminOperationalAlert) => void;
}>) {
  return (
    <div className="flex flex-wrap justify-end gap-2">
      {alert.workflowStatus === 'OPEN' && canAcknowledge ? (
        <Button size="sm" onClick={() => onAcknowledge(alert)}>
          تأیید دریافت
        </Button>
      ) : null}
      <ButtonLink href={alertDestination(alert)} variant="outline" size="sm">
        رفع عامل هشدار
      </ButtonLink>
    </div>
  );
}

function AlertDetails({
  alert,
  generatedAt,
}: Readonly<{ alert: AdminOperationalAlert; generatedAt: string }>) {
  const escalated = operationalAlertEscalated(alert, generatedAt);
  return (
    <div className="space-y-4">
      <Alert tone={escalated ? 'danger' : 'warning'} title={CODE[alert.code].label}>
        {CODE[alert.code].description}
      </Alert>
      <Card title="وضعیت هشدار">
        <DetailRows
          rows={[
            ['شماره سفارش', alert.orderNumber],
            ['وضعیت سفارش', alert.orderStatus],
            ['شدت', PRIORITY[alert.priority].label],
            ['سطح اعلان', escalated ? 'Escalation' : 'اعلان اولیه'],
            ['زمان رخداد', formatAdminDateTime(alert.incidentAt)],
            ['آخرین تشخیص', formatAdminDateTime(alert.lastDetectedAt)],
            ['مدت فعال‌بودن', formatAge(operationalAlertAgeMinutes(alert, generatedAt))],
            ['مهلت اقدام', alert.dueAt ? formatAdminDateTime(alert.dueAt) : 'ثبت نشده'],
          ]}
        />
      </Card>
      <Card title="تأیید و مسئول رسیدگی">
        <DetailRows
          rows={[
            ['وضعیت', WORKFLOW[alert.workflowStatus].label],
            ['تأیید توسط', actorLabel(alert.acknowledgedBy)],
            [
              'زمان تأیید',
              alert.acknowledgedAt ? formatAdminDateTime(alert.acknowledgedAt) : 'ثبت نشده',
            ],
            ['مسئول پیگیری', actorLabel(alert.assignedTo)],
            [
              'زمان رفع',
              alert.resolvedAt ? formatAdminDateTime(alert.resolvedAt) : 'هنوز فعال است',
            ],
            ['نتیجه رفع', alert.resolutionNote ?? 'ثبت نشده'],
          ]}
        />
      </Card>
    </div>
  );
}

function mutationError(status: number): string {
  if (status === 401) return 'نشست مدیریتی منقضی شده است. دوباره وارد شوید.';
  if (status === 403) return 'مجوز تأیید هشدار را ندارید.';
  if (status === 404) return 'هشدار پیدا نشد.';
  if (status === 409) return 'وضعیت هشدار تغییر کرده است؛ صفحه را تازه‌سازی کنید.';
  return 'تأیید هشدار انجام نشد. دوباره تلاش کنید.';
}

export function OperationalAlertsView({ alerts, summary, failed, canAcknowledge }: Props) {
  const router = useRouter();
  const [fallbackNow] = useState(() => new Date().toISOString());
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('OPEN');
  const [codeFilter, setCodeFilter] = useState<CodeFilter>('all');
  const [escalationFilter, setEscalationFilter] = useState<EscalationFilter>('all');
  const [detailsAlert, setDetailsAlert] = useState<AdminOperationalAlert | null>(null);
  const [mobileDetailsId, setMobileDetailsId] = useState<string | null>(null);
  const [acknowledgeAlert, setAcknowledgeAlert] = useState<AdminOperationalAlert | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const generatedAt = summary?.generatedAt ?? fallbackNow;
  const needle = toAsciiDigits(search).trim().toLocaleLowerCase('fa');
  const escalatedCount = alerts.filter(
    (alert) => alert.workflowStatus !== 'RESOLVED' && operationalAlertEscalated(alert, generatedAt),
  ).length;

  const filtered = useMemo(
    () =>
      alerts.filter((alert) => {
        const escalated = operationalAlertEscalated(alert, generatedAt);
        if (statusFilter !== 'all' && alert.workflowStatus !== statusFilter) return false;
        if (codeFilter !== 'all' && alert.code !== codeFilter) return false;
        if (escalationFilter === 'escalated' && !escalated) return false;
        if (escalationFilter === 'initial' && escalated) return false;
        if (!needle) return true;
        return [
          alert.orderNumber,
          CODE[alert.code].label,
          alert.acknowledgedBy ? actorLabel(alert.acknowledgedBy) : '',
          alert.assignedTo ? actorLabel(alert.assignedTo) : '',
        ].some((value) => toAsciiDigits(value).toLocaleLowerCase('fa').includes(needle));
      }),
    [alerts, codeFilter, escalationFilter, generatedAt, needle, statusFilter],
  );

  function openAcknowledge(alert: AdminOperationalAlert) {
    setMobileDetailsId(null);
    setDetailsAlert(null);
    setAcknowledgeAlert(alert);
    setError('');
    setSuccess('');
  }

  async function acknowledge() {
    if (!acknowledgeAlert || pending) return;
    setPending(true);
    setError('');
    try {
      const response = await fetch(
        `/api/operational-alerts/${encodeURIComponent(acknowledgeAlert.id)}/acknowledge`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{}',
        },
      );
      if (!response.ok) {
        setError(mutationError(response.status));
        return;
      }
      setAcknowledgeAlert(null);
      setSuccess('دریافت هشدار با موفقیت تأیید شد.');
      router.refresh();
    } catch {
      setError('ارتباط با سرور برقرار نشد. دوباره تلاش کنید.');
    } finally {
      setPending(false);
    }
  }

  const columns: readonly DataTableColumn<AdminOperationalAlert>[] = [
    {
      id: 'alert',
      header: 'هشدار',
      cell: (alert) => (
        <div className="max-w-64">
          <p className="font-bold">{CODE[alert.code].label}</p>
          <p className="mt-1 text-xs text-[var(--admin-color-muted)]" dir="ltr">
            {toPersianDigits(alert.orderNumber)}
          </p>
        </div>
      ),
    },
    {
      id: 'workflow',
      header: 'وضعیت',
      cell: (alert) => <WorkflowBadge status={alert.workflowStatus} />,
    },
    {
      id: 'level',
      header: 'سطح اعلان',
      cell: (alert) => (
        <EscalationBadge escalated={operationalAlertEscalated(alert, generatedAt)} />
      ),
    },
    {
      id: 'priority',
      header: 'شدت',
      cell: (alert) => (
        <Badge tone={PRIORITY[alert.priority].tone}>{PRIORITY[alert.priority].label}</Badge>
      ),
    },
    {
      id: 'age',
      header: 'مدت فعال‌بودن',
      visibility: 'lg',
      cell: (alert) => formatAge(operationalAlertAgeMinutes(alert, generatedAt)),
    },
    {
      id: 'actions',
      header: 'عملیات',
      align: 'end',
      cell: (alert) => (
        <div className="flex flex-wrap justify-end gap-2">
          <Button size="sm" variant="outline" onClick={() => setDetailsAlert(alert)}>
            جزئیات
          </Button>
          <AlertActions
            alert={alert}
            canAcknowledge={canAcknowledge}
            onAcknowledge={openAcknowledge}
          />
        </div>
      ),
    },
  ];

  const activeFilterCount =
    Number(Boolean(needle)) +
    Number(statusFilter !== 'OPEN') +
    Number(codeFilter !== 'all') +
    Number(escalationFilter !== 'all');

  return (
    <div className="space-y-6">
      {failed ? (
        <Alert tone="danger" title="بخشی از اطلاعات هشدارها دریافت نشد">
          اطلاعات ممکن است کامل نباشد؛ اتصال API را بررسی و صفحه را تازه‌سازی کنید.
        </Alert>
      ) : null}
      {success ? <Alert tone="success">{success}</Alert> : null}
      {!canAcknowledge ? (
        <Alert tone="info">دسترسی شما فقط برای مشاهده هشدارهای عملیاتی است.</Alert>
      ) : null}
      {summary?.delivery.failed ? (
        <Alert tone="warning" title="ارسال برخی اعلان‌ها ناموفق بوده است">
          {formatAdminInteger(summary.delivery.failed)} پیام هشدار در outbox ناموفق است و در مرحله
          مدیریت Notification Outbox بررسی خواهد شد.
        </Alert>
      ) : null}

      <section
        aria-label="شاخص‌های هشدار عملیاتی"
        className="grid grid-cols-2 gap-3 lg:grid-cols-4"
      >
        <Kpi
          label="هشدار فعال"
          value={summary?.activeIncidentCount ?? 0}
          description="نیازمند پیگیری"
          tone={summary?.activeIncidentCount ? 'warning' : 'success'}
        />
        <Kpi
          label="بحرانی"
          value={summary?.critical ?? 0}
          description="بالاترین شدت"
          tone={summary?.critical ? 'danger' : 'success'}
        />
        <Kpi
          label="Escalation"
          value={escalatedCount}
          description="عبور از مهلت پاسخ"
          tone={escalatedCount ? 'danger' : 'success'}
        />
        <Kpi
          label="مغایرت مرسوله"
          value={summary?.reconciliationRequired ?? 0}
          description="نیازمند تطبیق"
          tone={summary?.reconciliationRequired ? 'danger' : 'neutral'}
        />
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <AlertTypeChart summary={summary} />
        <DeliveryHealth summary={summary} />
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
                setStatusFilter('OPEN');
                setCodeFilter('all');
                setEscalationFilter('all');
              }}
            >
              بازنشانی فیلترها
            </Button>
          ) : undefined
        }
      >
        <SearchField
          aria-label="جستجوی هشدار عملیاتی"
          value={search}
          placeholder="شماره سفارش، نوع هشدار یا مسئول"
          onChange={(event) => setSearch(toPersianDigits(event.target.value))}
        />
        <Select
          aria-label="فیلتر وضعیت هشدار"
          value={statusFilter}
          options={STATUS_OPTIONS}
          onValueChange={(value) => setStatusFilter(value as StatusFilter)}
        />
        <Select
          aria-label="فیلتر نوع هشدار"
          value={codeFilter}
          options={CODE_OPTIONS}
          onValueChange={(value) => setCodeFilter(value as CodeFilter)}
        />
        <Select
          aria-label="فیلتر سطح اعلان"
          value={escalationFilter}
          options={ESCALATION_OPTIONS}
          onValueChange={(value) => setEscalationFilter(value as EscalationFilter)}
        />
      </FilterBar>

      <p className="text-xs text-[var(--admin-color-subtle)]">
        آخرین محاسبه هشدارها: {formatAdminDateTime(generatedAt)}
      </p>

      <ResponsiveDataView
        caption="هشدارهای عملیاتی"
        mobileLabel="کارت‌های هشدار عملیاتی"
        columns={columns}
        rows={filtered}
        getRowKey={(alert) => alert.id}
        getRowClassName={(alert) =>
          operationalAlertEscalated(alert, generatedAt)
            ? 'bg-[var(--admin-color-danger-soft)]/30'
            : undefined
        }
        emptyTitle={activeFilterCount ? 'نتیجه‌ای پیدا نشد' : 'هشدار تأییدنشده‌ای وجود ندارد'}
        emptyDescription="هشدارهای جدید پس از اسکن دوره‌ای عملیات در این بخش نمایش داده می‌شوند."
        renderMobileCard={(alert) => {
          const escalated = operationalAlertEscalated(alert, generatedAt);
          return (
            <MobileDataCard
              detailsOpen={mobileDetailsId === alert.id}
              onDetailsOpenChange={(open) => setMobileDetailsId(open ? alert.id : null)}
              title={CODE[alert.code].label}
              eyebrow={toPersianDigits(alert.orderNumber)}
              status={<WorkflowBadge status={alert.workflowStatus} />}
              items={[
                { label: 'سطح', value: escalated ? 'Escalation' : 'اولیه' },
                { label: 'شدت', value: PRIORITY[alert.priority].label },
                {
                  label: 'مدت فعال‌بودن',
                  value: formatAge(operationalAlertAgeMinutes(alert, generatedAt)),
                },
                {
                  label: 'آخرین تشخیص',
                  value: formatAdminDateTime(alert.lastDetectedAt),
                },
              ]}
              detailsTitle={`هشدار سفارش ${toPersianDigits(alert.orderNumber)}`}
              detailsDescription={CODE[alert.code].label}
              details={<AlertDetails alert={alert} generatedAt={generatedAt} />}
              detailsFooter={
                <AlertActions
                  alert={alert}
                  canAcknowledge={canAcknowledge}
                  onAcknowledge={openAcknowledge}
                />
              }
            />
          );
        }}
      />

      <Dialog
        open={detailsAlert !== null}
        onOpenChange={(open) => {
          if (!open) setDetailsAlert(null);
        }}
      >
        <DialogContent
          size="lg"
          title={
            detailsAlert
              ? `هشدار سفارش ${toPersianDigits(detailsAlert.orderNumber)}`
              : 'جزئیات هشدار'
          }
          description={detailsAlert ? CODE[detailsAlert.code].label : undefined}
          footer={
            detailsAlert ? (
              <AlertActions
                alert={detailsAlert}
                canAcknowledge={canAcknowledge}
                onAcknowledge={openAcknowledge}
              />
            ) : undefined
          }
        >
          {detailsAlert ? <AlertDetails alert={detailsAlert} generatedAt={generatedAt} /> : null}
        </DialogContent>
      </Dialog>

      <BottomSheet
        open={acknowledgeAlert !== null}
        onOpenChange={(open) => {
          if (!open && !pending) setAcknowledgeAlert(null);
        }}
      >
        <BottomSheetContent
          title="تأیید دریافت هشدار"
          description={
            acknowledgeAlert
              ? `سفارش ${toPersianDigits(acknowledgeAlert.orderNumber)} · ${CODE[acknowledgeAlert.code].label}`
              : undefined
          }
          hideClose={pending}
          footer={
            <>
              <Button
                variant="outline"
                disabled={pending}
                onClick={() => setAcknowledgeAlert(null)}
              >
                انصراف
              </Button>
              <Button loading={pending} onClick={acknowledge}>
                تأیید دریافت
              </Button>
            </>
          }
        >
          <Alert tone="warning">
            این اقدام فقط دریافت هشدار را ثبت می‌کند و به‌معنی رفع عامل هشدار نیست. عملیات بعدی از
            صفحه تخصصی آبکاری یا ارسال انجام می‌شود.
          </Alert>
          {error ? (
            <Alert tone="danger" className="mt-3">
              {error}
            </Alert>
          ) : null}
        </BottomSheetContent>
      </BottomSheet>
    </div>
  );
}
