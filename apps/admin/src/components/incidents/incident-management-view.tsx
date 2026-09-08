'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { Alert } from '@/components/ui/alert';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { DonutChart } from '@/components/ui/donut-chart';
import { FilterBar, SearchField } from '@/components/ui/filter-bar';
import { Textarea } from '@/components/ui/form-control';
import { FormField } from '@/components/ui/form-field';
import { MobileDataCard } from '@/components/ui/mobile-data-card';
import { ResponsiveDataView } from '@/components/ui/responsive-data-view';
import { Select } from '@/components/ui/select';
import type { DataTableColumn } from '@/components/ui/data-table';
import {
  parseOperationalIncident,
  type AdminIncidentActivity,
  type AdminOperationalIncident,
} from '@/lib/incidents/incidents-model';
import {
  OPERATIONAL_ALERT_CODES,
  type AdminOperationalAlert,
  type AdminOperationalAlertActor,
  type AdminOperationalAlertCode,
  type AdminOperationalAlertPriority,
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
  incidents: readonly AdminOperationalAlert[];
  failed: boolean;
  currentUserId: string;
  canManage: boolean;
}>;

type StatusFilter = AdminOperationalAlertWorkflowStatus | 'all';
type CodeFilter = AdminOperationalAlertCode | 'all';
type OwnershipFilter = 'all' | 'mine' | 'unassigned';
type DetailMode = 'desktop' | 'mobile' | null;

const CODE: Record<AdminOperationalAlertCode, Readonly<{ label: string; description: string }>> = {
  PLATING_OVERDUE: {
    label: 'تأخیر در آبکاری',
    description: 'زمان مورد انتظار عملیات آبکاری سپری شده است.',
  },
  PLATING_CANCELLED: {
    label: 'لغو آبکاری',
    description: 'عملیات آبکاری لغو شده و سفارش نیازمند تصمیم اجرایی است.',
  },
  SHIPMENT_CREATION_STALE: {
    label: 'تأخیر در ساخت مرسوله',
    description: 'سفارش آماده است اما مرسوله در زمان مقرر ساخته نشده است.',
  },
  SHIPMENT_PROVIDER_RECONCILIATION_REQUIRED: {
    label: 'مغایرت وضعیت مرسوله',
    description: 'وضعیت ثبت‌شده با نتیجه سرویس ارسال نیازمند تطبیق است.',
  },
};

const PRIORITY: Record<
  AdminOperationalAlertPriority,
  Readonly<{ label: string; tone: BadgeTone }>
> = {
  CRITICAL: { label: 'بحرانی', tone: 'danger' },
  HIGH: { label: 'زیاد', tone: 'warning' },
  MEDIUM: { label: 'متوسط', tone: 'info' },
  NORMAL: { label: 'عادی', tone: 'neutral' },
};

const WORKFLOW: Record<
  AdminOperationalAlertWorkflowStatus,
  Readonly<{ label: string; tone: BadgeTone }>
> = {
  OPEN: { label: 'باز', tone: 'danger' },
  ACKNOWLEDGED: { label: 'در حال پیگیری', tone: 'warning' },
  RESOLVED: { label: 'رفع‌شده', tone: 'success' },
};

const ACTIVITY: Record<
  AdminIncidentActivity['type'],
  Readonly<{ label: string; tone: BadgeTone }>
> = {
  DETECTED: { label: 'تشخیص رخداد', tone: 'danger' },
  ACKNOWLEDGED: { label: 'تأیید دریافت', tone: 'warning' },
  ASSIGNED: { label: 'تخصیص مسئول', tone: 'info' },
  UNASSIGNED: { label: 'لغو تخصیص', tone: 'neutral' },
  NOTE_ADDED: { label: 'ثبت یادداشت', tone: 'info' },
  RESOLVED: { label: 'رفع خودکار', tone: 'success' },
  REOPENED: { label: 'بازگشایی رخداد', tone: 'danger' },
};

const STATUS_OPTIONS = [
  { value: 'all', label: 'همه وضعیت‌ها' },
  { value: 'OPEN', label: 'باز' },
  { value: 'ACKNOWLEDGED', label: 'در حال پیگیری' },
  { value: 'RESOLVED', label: 'رفع‌شده' },
];

const CODE_OPTIONS = [
  { value: 'all', label: 'همه انواع رخداد' },
  ...OPERATIONAL_ALERT_CODES.map((code) => ({ value: code, label: CODE[code].label })),
];

const OWNERSHIP_OPTIONS = [
  { value: 'all', label: 'همه مسئول‌ها' },
  { value: 'mine', label: 'اختصاص‌یافته به من' },
  { value: 'unassigned', label: 'بدون مسئول' },
];

function actorLabel(actor: AdminOperationalAlertActor | null): string {
  if (!actor) return 'بدون مسئول';
  const name = [actor.firstName, actor.lastName].filter(Boolean).join(' ');
  return name || formatAdminPhone(actor.phone);
}

function WorkflowBadge({ status }: Readonly<{ status: AdminOperationalAlertWorkflowStatus }>) {
  return (
    <Badge tone={WORKFLOW[status].tone} dot>
      {WORKFLOW[status].label}
    </Badge>
  );
}

function Kpi({
  label,
  value,
  description,
  tone = 'neutral',
}: Readonly<{ label: string; value: number; description: string; tone?: BadgeTone }>) {
  return (
    <Card className="h-full">
      <Badge tone={tone}>{label}</Badge>
      <p className="mt-3 text-2xl font-black tabular-nums">{formatAdminInteger(value)}</p>
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

function Timeline({ activities }: Readonly<{ activities: readonly AdminIncidentActivity[] }>) {
  return (
    <ol aria-label="تاریخچه رخداد" className="space-y-0">
      {[...activities].reverse().map((activity, index) => (
        <li
          key={activity.id}
          className="relative grid grid-cols-[1.25rem_minmax(0,1fr)] gap-3 pb-4"
        >
          {index < activities.length - 1 ? (
            <span
              aria-hidden="true"
              className="absolute top-5 bottom-0 right-[0.59rem] w-px bg-[var(--admin-color-border)]"
            />
          ) : null}
          <span
            aria-hidden="true"
            className="relative z-10 mt-1 size-5 rounded-full border-4 border-[var(--admin-color-surface)] bg-[var(--admin-color-primary)] shadow-[0_0_0_1px_var(--admin-color-border)]"
          />
          <div className="min-w-0 rounded-[var(--admin-radius-md)] bg-[var(--admin-color-surface-subtle)] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Badge tone={ACTIVITY[activity.type].tone}>{ACTIVITY[activity.type].label}</Badge>
              <time className="text-[0.6875rem] text-[var(--admin-color-subtle)]">
                {formatAdminDateTime(activity.createdAt)}
              </time>
            </div>
            <p className="mt-2 text-xs text-[var(--admin-color-muted)]">
              ثبت‌کننده: {activity.actor ? actorLabel(activity.actor) : 'سامانه'}
            </p>
            {activity.note ? (
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{activity.note}</p>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

type IncidentActionsProps = Readonly<{
  incident: AdminOperationalAlert;
  currentUserId: string;
  canManage: boolean;
  pending: boolean;
  onAction: (action: 'acknowledge' | 'assign' | 'unassign') => void;
}>;

function IncidentActions({
  incident,
  currentUserId,
  canManage,
  pending,
  onAction,
}: IncidentActionsProps) {
  const active = incident.workflowStatus !== 'RESOLVED';
  const operationPath = incident.code.startsWith('PLATING_') ? '/plating' : '/shipping';
  return (
    <div className="flex flex-wrap justify-end gap-2">
      <ButtonLink href="/orders" variant="outline" size="sm">
        صفحه سفارش‌ها
      </ButtonLink>
      <ButtonLink href={operationPath} variant="outline" size="sm">
        رفع عامل رخداد
      </ButtonLink>
      {canManage && active && incident.workflowStatus === 'OPEN' ? (
        <Button size="sm" disabled={pending} onClick={() => onAction('acknowledge')}>
          تأیید دریافت
        </Button>
      ) : null}
      {canManage && active && incident.assignedTo?.id !== currentUserId ? (
        <Button size="sm" variant="secondary" disabled={pending} onClick={() => onAction('assign')}>
          اختصاص به من
        </Button>
      ) : null}
      {canManage && active && incident.assignedTo ? (
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => onAction('unassign')}>
          لغو تخصیص
        </Button>
      ) : null}
    </div>
  );
}

type IncidentDetailsProps = Readonly<{
  incident: AdminOperationalIncident | null;
  loading: boolean;
  error: string;
  feedback: string;
  note: string;
  noteError: string;
  canManage: boolean;
  pending: boolean;
  onNoteChange: (value: string) => void;
  onSubmitNote: () => void;
}>;

function IncidentDetails({
  incident,
  loading,
  error,
  feedback,
  note,
  noteError,
  canManage,
  pending,
  onNoteChange,
  onSubmitNote,
}: IncidentDetailsProps) {
  if (loading) {
    return (
      <p role="status" className="py-10 text-center text-sm">
        در حال دریافت جزئیات رخداد…
      </p>
    );
  }
  if (error && !incident) return <Alert tone="danger">{error}</Alert>;
  if (!incident) return null;
  return (
    <div className="space-y-4">
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {feedback ? <Alert tone="success">{feedback}</Alert> : null}
      <Alert
        tone={incident.workflowStatus === 'RESOLVED' ? 'success' : 'warning'}
        title={CODE[incident.code].label}
      >
        {CODE[incident.code].description}
      </Alert>
      <div className="grid gap-3 lg:grid-cols-2">
        <Card title="اطلاعات رخداد">
          <DetailRows
            rows={[
              ['شماره سفارش', incident.orderNumber],
              ['وضعیت سفارش', incident.orderStatus],
              ['شدت', PRIORITY[incident.priority].label],
              ['وضعیت پیگیری', WORKFLOW[incident.workflowStatus].label],
              ['زمان رخداد', formatAdminDateTime(incident.incidentAt)],
              ['آخرین تشخیص', formatAdminDateTime(incident.lastDetectedAt)],
              ['مهلت اقدام', incident.dueAt ? formatAdminDateTime(incident.dueAt) : 'ثبت نشده'],
            ]}
          />
        </Card>
        <Card title="مالکیت و نتیجه">
          <DetailRows
            rows={[
              ['مسئول پیگیری', actorLabel(incident.assignedTo)],
              [
                'تأیید توسط',
                incident.acknowledgedBy ? actorLabel(incident.acknowledgedBy) : 'ثبت نشده',
              ],
              [
                'زمان تأیید',
                incident.acknowledgedAt ? formatAdminDateTime(incident.acknowledgedAt) : 'ثبت نشده',
              ],
              [
                'زمان رفع',
                incident.resolvedAt ? formatAdminDateTime(incident.resolvedAt) : 'هنوز فعال است',
              ],
              ['روش رفع', incident.resolutionSource ?? 'ثبت نشده'],
              ['نتیجه رفع', incident.resolutionNote ?? 'ثبت نشده'],
            ]}
          />
        </Card>
      </div>
      {canManage ? (
        <Card
          title="ثبت یادداشت پیگیری"
          description="تصمیم یا اقدام انجام‌شده را برای تیم بعدی ثبت کنید."
        >
          <FormField
            id="incident-note"
            label="یادداشت"
            required
            error={noteError}
            hint={`${formatAdminInteger(note.length)} از ${formatAdminInteger(1000)} کاراکتر`}
          >
            {(controlProps) => (
              <Textarea
                {...controlProps}
                value={note}
                maxLength={1000}
                placeholder="مثلاً وضعیت با تیم ارسال بررسی شد و تا ساعت ۱۶ پیگیری می‌شود."
                disabled={pending}
                onChange={(event) => onNoteChange(event.target.value)}
              />
            )}
          </FormField>
          <div className="mt-3 flex justify-end">
            <Button size="sm" loading={pending} onClick={onSubmitNote}>
              ثبت یادداشت
            </Button>
          </div>
        </Card>
      ) : null}
      <Card title="Timeline رخداد" description="جدیدترین رویداد در ابتدای فهرست نمایش داده می‌شود.">
        <Timeline activities={incident.activities} />
      </Card>
    </div>
  );
}

function requestError(status: number): string {
  if (status === 401) return 'نشست مدیریتی منقضی شده است. دوباره وارد شوید.';
  if (status === 403) return 'مجوز انجام این عملیات را ندارید.';
  if (status === 404) return 'رخداد پیدا نشد.';
  if (status === 409) return 'وضعیت رخداد تغییر کرده است؛ صفحه را تازه‌سازی کنید.';
  if (status === 400) return 'اطلاعات واردشده معتبر نیست.';
  return 'عملیات انجام نشد. دوباره تلاش کنید.';
}

export function IncidentManagementView({ incidents, failed, currentUserId, canManage }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('OPEN');
  const [codeFilter, setCodeFilter] = useState<CodeFilter>('all');
  const [ownershipFilter, setOwnershipFilter] = useState<OwnershipFilter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailMode, setDetailMode] = useState<DetailMode>(null);
  const [detail, setDetail] = useState<AdminOperationalIncident | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState('');
  const needle = toAsciiDigits(search).trim().toLocaleLowerCase('fa');

  const filtered = useMemo(
    () =>
      incidents.filter((incident) => {
        if (statusFilter !== 'all' && incident.workflowStatus !== statusFilter) return false;
        if (codeFilter !== 'all' && incident.code !== codeFilter) return false;
        if (ownershipFilter === 'mine' && incident.assignedTo?.id !== currentUserId) return false;
        if (ownershipFilter === 'unassigned' && incident.assignedTo) return false;
        if (!needle) return true;
        return [
          incident.orderNumber,
          CODE[incident.code].label,
          actorLabel(incident.assignedTo),
        ].some((value) => toAsciiDigits(value).toLocaleLowerCase('fa').includes(needle));
      }),
    [codeFilter, currentUserId, incidents, needle, ownershipFilter, statusFilter],
  );

  const counts = useMemo(
    () => ({
      open: incidents.filter((item) => item.workflowStatus === 'OPEN').length,
      acknowledged: incidents.filter((item) => item.workflowStatus === 'ACKNOWLEDGED').length,
      resolved: incidents.filter((item) => item.workflowStatus === 'RESOLVED').length,
      mine: incidents.filter(
        (item) => item.workflowStatus !== 'RESOLVED' && item.assignedTo?.id === currentUserId,
      ).length,
      unassigned: incidents.filter(
        (item) => item.workflowStatus !== 'RESOLVED' && item.assignedTo === null,
      ).length,
    }),
    [currentUserId, incidents],
  );

  async function loadDetails(incident: AdminOperationalAlert, mode: Exclude<DetailMode, null>) {
    setSelectedId(incident.id);
    setDetailMode(mode);
    setDetail(null);
    setDetailError('');
    setFeedback('');
    setNote('');
    setNoteError('');
    setDetailLoading(true);
    try {
      const response = await fetch(`/api/operational-incidents/${encodeURIComponent(incident.id)}`);
      if (!response.ok) {
        setDetailError(requestError(response.status));
        return;
      }
      const parsed = parseOperationalIncident(await response.json());
      if (!parsed) {
        setDetailError('پاسخ جزئیات رخداد معتبر نیست.');
        return;
      }
      setDetail(parsed);
    } catch {
      setDetailError('ارتباط با سرور برقرار نشد. دوباره تلاش کنید.');
    } finally {
      setDetailLoading(false);
    }
  }

  function closeDetails() {
    if (pending) return;
    setSelectedId(null);
    setDetailMode(null);
    setDetail(null);
  }

  async function mutate(action: 'acknowledge' | 'assign' | 'unassign' | 'notes', body: object) {
    if (!selectedId || pending) return;
    setPending(true);
    setDetailError('');
    setFeedback('');
    try {
      const response = await fetch(
        `/api/operational-incidents/${encodeURIComponent(selectedId)}/${action}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      );
      if (!response.ok) {
        setDetailError(requestError(response.status));
        return;
      }
      const parsed = parseOperationalIncident(await response.json());
      if (!parsed) {
        setDetailError('پاسخ به‌روزشده رخداد معتبر نیست.');
        return;
      }
      setDetail(parsed);
      setFeedback(
        action === 'acknowledge'
          ? 'دریافت رخداد تأیید شد.'
          : action === 'assign'
            ? 'رخداد به شما اختصاص یافت.'
            : action === 'unassign'
              ? 'تخصیص رخداد لغو شد.'
              : 'یادداشت پیگیری ثبت شد.',
      );
      if (action === 'notes') setNote('');
      router.refresh();
    } catch {
      setDetailError('ارتباط با سرور برقرار نشد. دوباره تلاش کنید.');
    } finally {
      setPending(false);
    }
  }

  function handleAction(action: 'acknowledge' | 'assign' | 'unassign') {
    void mutate(action, action === 'assign' ? { userId: currentUserId } : {});
  }

  function submitNote() {
    const normalized = note.trim();
    if (!normalized) {
      setNoteError('متن یادداشت را وارد کنید.');
      return;
    }
    setNoteError('');
    void mutate('notes', { note: normalized });
  }

  const selectedIncident = detail ?? incidents.find((item) => item.id === selectedId) ?? null;
  const detailsNode = (
    <IncidentDetails
      incident={detail}
      loading={detailLoading}
      error={detailError}
      feedback={feedback}
      note={note}
      noteError={noteError}
      canManage={canManage}
      pending={pending}
      onNoteChange={(value) => {
        setNote(value);
        if (noteError) setNoteError('');
      }}
      onSubmitNote={submitNote}
    />
  );
  const detailsFooter = selectedIncident ? (
    <IncidentActions
      incident={selectedIncident}
      currentUserId={currentUserId}
      canManage={canManage}
      pending={pending}
      onAction={handleAction}
    />
  ) : undefined;

  const columns: readonly DataTableColumn<AdminOperationalAlert>[] = [
    {
      id: 'incident',
      header: 'رخداد',
      cell: (incident) => (
        <div className="max-w-64">
          <p className="font-bold">{CODE[incident.code].label}</p>
          <p className="mt-1 text-xs text-[var(--admin-color-muted)]" dir="ltr">
            {toPersianDigits(incident.orderNumber)}
          </p>
        </div>
      ),
    },
    {
      id: 'status',
      header: 'وضعیت',
      cell: (incident) => <WorkflowBadge status={incident.workflowStatus} />,
    },
    {
      id: 'priority',
      header: 'شدت',
      cell: (incident) => (
        <Badge tone={PRIORITY[incident.priority].tone}>{PRIORITY[incident.priority].label}</Badge>
      ),
    },
    {
      id: 'owner',
      header: 'مسئول',
      visibility: 'lg',
      cell: (incident) => actorLabel(incident.assignedTo),
    },
    {
      id: 'updated',
      header: 'آخرین تشخیص',
      visibility: 'lg',
      cell: (incident) => formatAdminDateTime(incident.lastDetectedAt),
    },
    {
      id: 'actions',
      header: 'عملیات',
      align: 'end',
      cell: (incident) => (
        <Button size="sm" variant="outline" onClick={() => void loadDetails(incident, 'desktop')}>
          جزئیات و پیگیری
        </Button>
      ),
    },
  ];

  const activeFilterCount =
    Number(Boolean(needle)) +
    Number(statusFilter !== 'OPEN') +
    Number(codeFilter !== 'all') +
    Number(ownershipFilter !== 'all');

  return (
    <div className="space-y-6">
      {failed ? (
        <Alert tone="danger" title="رخدادها دریافت نشدند">
          اتصال API را بررسی و صفحه را تازه‌سازی کنید.
        </Alert>
      ) : null}
      {!canManage ? (
        <Alert tone="info">دسترسی شما فقط برای مشاهده رخدادها و timeline است.</Alert>
      ) : null}

      <section aria-label="شاخص‌های مدیریت رخداد" className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi
          label="باز"
          value={counts.open}
          description="تأییدنشده"
          tone={counts.open ? 'danger' : 'success'}
        />
        <Kpi
          label="در پیگیری"
          value={counts.acknowledged}
          description="تأییدشده و فعال"
          tone="warning"
        />
        <Kpi label="مسئولیت من" value={counts.mine} description="رخداد فعال" tone="info" />
        <Kpi
          label="بدون مسئول"
          value={counts.unassigned}
          description="نیازمند تخصیص"
          tone={counts.unassigned ? 'warning' : 'success'}
        />
        <Kpi label="رفع‌شده" value={counts.resolved} description="سوابق بسته‌شده" tone="success" />
      </section>

      <Card
        title="ترکیب وضعیت رخدادها"
        description="نمای سریع حجم کار باز، در حال پیگیری و رفع‌شده"
      >
        <DonutChart
          title="ترکیب وضعیت رخدادها"
          centerLabel="رخداد"
          segments={[
            { label: 'باز', value: counts.open, color: 'var(--admin-color-danger)' },
            {
              label: 'در حال پیگیری',
              value: counts.acknowledged,
              color: 'var(--admin-color-warning)',
            },
            { label: 'رفع‌شده', value: counts.resolved, color: 'var(--admin-color-success)' },
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
                setStatusFilter('OPEN');
                setCodeFilter('all');
                setOwnershipFilter('all');
              }}
            >
              بازنشانی فیلترها
            </Button>
          ) : undefined
        }
      >
        <SearchField
          aria-label="جستجوی رخداد"
          value={search}
          placeholder="شماره سفارش، نوع رخداد یا مسئول"
          onChange={(event) => setSearch(toPersianDigits(event.target.value))}
        />
        <Select
          aria-label="فیلتر وضعیت رخداد"
          value={statusFilter}
          options={STATUS_OPTIONS}
          onValueChange={(value) => setStatusFilter(value as StatusFilter)}
        />
        <Select
          aria-label="فیلتر نوع رخداد"
          value={codeFilter}
          options={CODE_OPTIONS}
          onValueChange={(value) => setCodeFilter(value as CodeFilter)}
        />
        <Select
          aria-label="فیلتر مسئول رخداد"
          value={ownershipFilter}
          options={OWNERSHIP_OPTIONS}
          onValueChange={(value) => setOwnershipFilter(value as OwnershipFilter)}
        />
      </FilterBar>

      <ResponsiveDataView
        caption="رخدادهای عملیاتی"
        mobileLabel="کارت‌های رخداد عملیاتی"
        columns={columns}
        rows={filtered}
        getRowKey={(incident) => incident.id}
        emptyTitle={activeFilterCount ? 'نتیجه‌ای پیدا نشد' : 'رخداد بازی وجود ندارد'}
        emptyDescription="رخدادهای جدید پس از تشخیص سامانه در این صف قرار می‌گیرند."
        renderMobileCard={(incident) => (
          <MobileDataCard
            detailsOpen={detailMode === 'mobile' && selectedId === incident.id}
            onDetailsOpenChange={(open) => {
              if (open) void loadDetails(incident, 'mobile');
              else closeDetails();
            }}
            title={CODE[incident.code].label}
            eyebrow={toPersianDigits(incident.orderNumber)}
            status={<WorkflowBadge status={incident.workflowStatus} />}
            items={[
              { label: 'شدت', value: PRIORITY[incident.priority].label },
              { label: 'مسئول', value: actorLabel(incident.assignedTo) },
              { label: 'آخرین تشخیص', value: formatAdminDateTime(incident.lastDetectedAt) },
              { label: 'وضعیت سفارش', value: incident.orderStatus },
            ]}
            detailsTitle={`رخداد سفارش ${toPersianDigits(incident.orderNumber)}`}
            detailsDescription={CODE[incident.code].label}
            details={detailsNode}
            detailsFooter={detailsFooter}
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
          hideClose={pending}
          title={
            selectedIncident
              ? `رخداد سفارش ${toPersianDigits(selectedIncident.orderNumber)}`
              : 'جزئیات رخداد'
          }
          description={selectedIncident ? CODE[selectedIncident.code].label : undefined}
          footer={detailsFooter}
        >
          {detailsNode}
        </DialogContent>
      </Dialog>
    </div>
  );
}
