'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState, type FormEvent } from 'react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { DataTableColumn } from '@/components/ui/data-table';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { DonutChart } from '@/components/ui/donut-chart';
import { FilterBar, SearchField } from '@/components/ui/filter-bar';
import { Input, Textarea } from '@/components/ui/form-control';
import { FormField } from '@/components/ui/form-field';
import { MobileDataCard } from '@/components/ui/mobile-data-card';
import { ResponsiveDataView } from '@/components/ui/responsive-data-view';
import { Select } from '@/components/ui/select';
import type {
  PaymentInitiationCandidate,
  PaymentOperationsSummary,
} from '@/lib/payments/payment-operations-model';
import {
  formatAdminDateTime,
  formatAdminInteger,
  formatAdminPhone,
  formatAdminToman,
  toAsciiDigits,
  toPersianDigits,
} from '@/lib/presentation/formatters';
import type { AdminPaymentAttempt } from '@/lib/transactions/payment-transactions-model';

type Props = Readonly<{
  summary: PaymentOperationsSummary | null;
  candidates: readonly PaymentInitiationCandidate[];
  history: readonly AdminPaymentAttempt[];
  failed: boolean;
  canWrite: boolean;
}>;

type Queue = 'active' | 'history';
type Resolution = 'REDIRECTED' | 'ABANDONED';
type ResolutionFilter = 'all' | Resolution;
type ActiveAction = Readonly<{
  candidate: PaymentInitiationCandidate;
  resolution: Resolution;
}>;

const ORDER_STATUS_LABELS: Readonly<Record<string, string>> = {
  PENDING_PAYMENT: 'در انتظار پرداخت',
  PAID: 'پرداخت‌شده',
  PROCESSING: 'در حال پردازش',
  SHIPPED: 'ارسال‌شده',
  DELIVERED: 'تحویل‌شده',
  CANCELLED: 'لغوشده',
  EXPIRED: 'منقضی‌شده',
};

const PAYMENT_STATUS_LABELS: Readonly<Record<string, string>> = {
  PENDING: 'در انتظار پرداخت',
  PAID: 'پرداخت‌شده',
  CANCELLED: 'لغوشده',
};

function providerLabel(provider: string) {
  const labels: Readonly<Record<string, string>> = {
    zarinpal: 'زرین‌پال',
    zibal: 'زیبال',
    mellat: 'بانک ملت',
  };
  return labels[provider.toLocaleLowerCase('en')] ?? toPersianDigits(provider);
}

function orderStatusLabel(status: string) {
  return ORDER_STATUS_LABELS[status] ?? toPersianDigits(status);
}

function paymentStatusLabel(status: string) {
  return PAYMENT_STATUS_LABELS[status] ?? toPersianDigits(status);
}

function actorLabel(attempt: AdminPaymentAttempt) {
  const actor = attempt.initiationRecoveryResolvedBy;
  if (!actor) return 'ثبت نشده';
  return (
    [actor.firstName, actor.lastName].filter(Boolean).join(' ') || formatAdminPhone(actor.phone)
  );
}

function customerLabel(attempt: AdminPaymentAttempt) {
  const customer = attempt.payment.order.user;
  return (
    [customer.firstName, customer.lastName].filter(Boolean).join(' ') ||
    formatAdminPhone(customer.phone)
  );
}

function isEscalated(createdAt: string) {
  return Date.now() - new Date(createdAt).getTime() >= 30 * 60 * 1000;
}

function canRestoreRedirect(candidate: PaymentInitiationCandidate) {
  return (
    candidate.payment.status === 'PENDING' &&
    candidate.payment.order.status === 'PENDING_PAYMENT' &&
    new Date(candidate.payment.order.reservationExpiresAt).getTime() > Date.now() &&
    candidate.amountToman === candidate.payment.amountToman &&
    candidate.payment.amountToman === candidate.payment.order.grandTotalToman
  );
}

function PriorityBadge({ createdAt }: Readonly<{ createdAt: string }>) {
  return isEscalated(createdAt) ? (
    <Badge tone="danger" dot>
      بحرانی
    </Badge>
  ) : (
    <Badge tone="warning" dot>
      نیازمند بررسی
    </Badge>
  );
}

function ResolutionBadge({ resolution }: Readonly<{ resolution: string | null }>) {
  return resolution === 'REDIRECTED' ? (
    <Badge tone="success">هدایت بازیابی شد</Badge>
  ) : (
    <Badge tone="neutral">مختومه شد</Badge>
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

function CandidateDetails({ candidate }: Readonly<{ candidate: PaymentInitiationCandidate }>) {
  const restorable = canRestoreRedirect(candidate);
  return (
    <div className="space-y-4">
      <Alert
        tone={restorable ? 'warning' : 'danger'}
        title={restorable ? 'امکان بازیابی هدایت وجود دارد' : 'هدایت پرداخت قابل بازیابی نیست'}
      >
        {restorable
          ? 'اطلاعات پنل درگاه و مبلغ را بررسی کنید و فقط URL معتبر همان تلاش را ثبت کنید.'
          : 'سفارش منقضی شده، دیگر قابل پرداخت نیست یا مبالغ منطبق نیستند؛ پس از بررسی درگاه تلاش را مختومه کنید.'}
      </Alert>
      <DetailRows
        rows={[
          ['شناسه تلاش', candidate.id],
          ['شماره سفارش', candidate.payment.order.orderNumber],
          ['درگاه', providerLabel(candidate.provider)],
          ['مبلغ تلاش', formatAdminToman(candidate.amountToman)],
          ['مبلغ پرداخت', formatAdminToman(candidate.payment.amountToman)],
          ['مبلغ سفارش', formatAdminToman(candidate.payment.order.grandTotalToman)],
          ['وضعیت پرداخت', paymentStatusLabel(candidate.payment.status)],
          ['وضعیت سفارش', orderStatusLabel(candidate.payment.order.status)],
          ['زمان ایجاد', formatAdminDateTime(candidate.createdAt)],
          ['آخرین تغییر', formatAdminDateTime(candidate.updatedAt)],
          ['انقضای رزرو', formatAdminDateTime(candidate.payment.order.reservationExpiresAt)],
        ]}
      />
    </div>
  );
}

function HistoryDetails({ attempt }: Readonly<{ attempt: AdminPaymentAttempt }>) {
  return (
    <div className="space-y-4">
      <Alert
        tone={attempt.initiationRecoveryResolution === 'REDIRECTED' ? 'success' : 'info'}
        title={
          attempt.initiationRecoveryResolution === 'REDIRECTED'
            ? 'هدایت پرداخت بازیابی شده است'
            : 'تلاش پرداخت پس از بررسی مختومه شده است'
        }
      >
        {toPersianDigits(attempt.initiationRecoveryNote ?? 'یادداشت اپراتور ثبت نشده است.')}
      </Alert>
      <DetailRows
        rows={[
          ['شناسه تلاش', attempt.id],
          ['شماره سفارش', attempt.payment.order.orderNumber],
          ['مشتری', customerLabel(attempt)],
          ['شماره همراه', formatAdminPhone(attempt.payment.order.user.phone)],
          ['درگاه', providerLabel(attempt.provider)],
          ['نتیجه recovery', attempt.initiationRecoveryResolution ?? 'ثبت نشده'],
          ['وضعیت نهایی تلاش', attempt.status],
          ['Authority', attempt.authority ?? 'ثبت نشده'],
          ['مبلغ تلاش', formatAdminToman(attempt.amountToman)],
          ['اپراتور', actorLabel(attempt)],
          [
            'زمان تعیین تکلیف',
            attempt.initiationRecoveryResolvedAt
              ? formatAdminDateTime(attempt.initiationRecoveryResolvedAt)
              : 'ثبت نشده',
          ],
          ['زمان ایجاد', formatAdminDateTime(attempt.createdAt)],
        ]}
      />
    </div>
  );
}

function KpiCard({
  label,
  value,
  tone = 'neutral',
}: Readonly<{
  label: string;
  value: number;
  tone?: 'neutral' | 'warning' | 'danger' | 'success';
}>) {
  const toneClass = {
    neutral: 'text-[var(--admin-color-ink)]',
    warning: 'text-[var(--admin-color-warning)]',
    danger: 'text-[var(--admin-color-danger)]',
    success: 'text-[var(--admin-color-success)]',
  }[tone];
  return (
    <Card>
      <p className="text-xs text-[var(--admin-color-muted)]">{label}</p>
      <p className={`mt-2 text-2xl font-black ${toneClass}`}>{formatAdminInteger(value)}</p>
    </Card>
  );
}

function mutationErrorMessage(status: number) {
  if (status === 401) return 'نشست مدیریتی منقضی شده است. دوباره وارد شوید.';
  if (status === 403) return 'مجوز انجام عملیات بازیابی را ندارید.';
  if (status === 404) return 'تلاش پرداخت پیدا نشد یا دیگر در صف نیست.';
  if (status === 409) return 'وضعیت تلاش هم‌زمان تغییر کرده است؛ صفحه را تازه‌سازی کنید.';
  if (status === 400 || status === 422)
    return 'اطلاعات درگاه معتبر نیست یا سفارش دیگر اجازه بازیابی این تلاش را نمی‌دهد.';
  return 'عملیات بازیابی پرداخت انجام نشد. دوباره تلاش کنید.';
}

export function PaymentRecoveryView({ summary, candidates, history, failed, canWrite }: Props) {
  const router = useRouter();
  const [queue, setQueue] = useState<Queue>('active');
  const [search, setSearch] = useState('');
  const [provider, setProvider] = useState('all');
  const [resolution, setResolution] = useState<ResolutionFilter>('all');
  const [mobileDetailsId, setMobileDetailsId] = useState<string | null>(null);
  const [candidateDetails, setCandidateDetails] = useState<PaymentInitiationCandidate | null>(null);
  const [historyDetails, setHistoryDetails] = useState<AdminPaymentAttempt | null>(null);
  const [action, setAction] = useState<ActiveAction | null>(null);
  const [authority, setAuthority] = useState('');
  const [paymentUrl, setPaymentUrl] = useState('');
  const [note, setNote] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const providers = useMemo(
    () => [
      ...new Set([
        ...candidates.map((item) => item.provider),
        ...history.map((item) => item.provider),
      ]),
    ],
    [candidates, history],
  );
  const needle = toAsciiDigits(search).trim().toLocaleLowerCase('fa');
  const filteredCandidates = useMemo(
    () =>
      candidates.filter((candidate) => {
        if (provider !== 'all' && candidate.provider !== provider) return false;
        if (!needle) return true;
        return [candidate.id, candidate.provider, candidate.payment.order.orderNumber].some(
          (value) => toAsciiDigits(value).toLocaleLowerCase('fa').includes(needle),
        );
      }),
    [candidates, needle, provider],
  );
  const filteredHistory = useMemo(
    () =>
      history.filter((attempt) => {
        if (provider !== 'all' && attempt.provider !== provider) return false;
        if (resolution !== 'all' && attempt.initiationRecoveryResolution !== resolution)
          return false;
        if (!needle) return true;
        return [
          attempt.id,
          attempt.provider,
          attempt.authority,
          attempt.payment.order.orderNumber,
          customerLabel(attempt),
          attempt.payment.order.user.phone,
          attempt.initiationRecoveryNote,
          actorLabel(attempt),
        ].some((value) =>
          value ? toAsciiDigits(value).toLocaleLowerCase('fa').includes(needle) : false,
        );
      }),
    [history, needle, provider, resolution],
  );

  const escalatedCount = candidates.filter((candidate) => isEscalated(candidate.createdAt)).length;
  const restorableCount = candidates.filter(canRestoreRedirect).length;
  const redirectedCount = history.filter(
    (attempt) => attempt.initiationRecoveryResolution === 'REDIRECTED',
  ).length;
  const abandonedCount = history.filter(
    (attempt) => attempt.initiationRecoveryResolution === 'ABANDONED',
  ).length;
  const activeFilterCount =
    Number(Boolean(search.trim())) +
    Number(provider !== 'all') +
    Number(queue === 'history' && resolution !== 'all');

  function resetFilters() {
    setSearch('');
    setProvider('all');
    setResolution('all');
  }

  function openAction(candidate: PaymentInitiationCandidate, nextResolution: Resolution) {
    setCandidateDetails(null);
    setMobileDetailsId(null);
    setAction({ candidate, resolution: nextResolution });
    setAuthority('');
    setPaymentUrl('');
    setNote('');
    setError('');
  }

  function closeAction() {
    if (pending) return;
    setAction(null);
    setError('');
  }

  async function submitAction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!action || pending) return;
    const normalizedNote = note.trim();
    if (normalizedNote.length < 3) {
      setError('یادداشت بررسی باید حداقل ۳ نویسه باشد.');
      return;
    }

    const body: Record<string, string> = {
      resolution: action.resolution,
      note: normalizedNote,
    };
    if (action.resolution === 'REDIRECTED') {
      const normalizedAuthority = toAsciiDigits(authority).trim();
      const normalizedUrl = toAsciiDigits(paymentUrl).trim();
      if (!normalizedAuthority || !normalizedUrl) {
        setError('شناسه Authority و نشانی پرداخت الزامی است.');
        return;
      }
      body.authority = normalizedAuthority;
      body.paymentUrl = normalizedUrl;
    }

    setPending(true);
    setError('');
    try {
      const response = await fetch(
        `/api/payments/initiation-recovery/${encodeURIComponent(action.candidate.id)}/resolve`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      );
      if (!response.ok) {
        setError(mutationErrorMessage(response.status));
        return;
      }
      setSuccess(
        action.resolution === 'REDIRECTED'
          ? 'مسیر هدایت معتبر بازیابی شد.'
          : 'تلاش پرداخت پس از بررسی درگاه مختومه شد.',
      );
      setAction(null);
      router.refresh();
    } catch {
      setError('ارتباط با سرور برقرار نشد. دوباره تلاش کنید.');
    } finally {
      setPending(false);
    }
  }

  const activeColumns: readonly DataTableColumn<PaymentInitiationCandidate>[] = [
    {
      id: 'order',
      header: 'سفارش',
      cell: (candidate) => (
        <div>
          <p className="font-bold">{toPersianDigits(candidate.payment.order.orderNumber)}</p>
          <p className="mt-1 text-xs text-[var(--admin-color-muted)]">
            {formatAdminDateTime(candidate.createdAt)}
          </p>
        </div>
      ),
    },
    { id: 'provider', header: 'درگاه', cell: (candidate) => providerLabel(candidate.provider) },
    {
      id: 'amount',
      header: 'مبلغ',
      cell: (candidate) => formatAdminToman(candidate.amountToman),
    },
    {
      id: 'payable',
      header: 'امکان هدایت',
      cell: (candidate) =>
        canRestoreRedirect(candidate) ? (
          <Badge tone="success">قابل بازیابی</Badge>
        ) : (
          <Badge tone="neutral">فقط تعیین تکلیف</Badge>
        ),
      visibility: 'lg',
    },
    {
      id: 'priority',
      header: 'اولویت',
      cell: (candidate) => <PriorityBadge createdAt={candidate.createdAt} />,
    },
    {
      id: 'actions',
      header: 'عملیات',
      align: 'end',
      cell: (candidate) => (
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={() => setCandidateDetails(candidate)}>
            جزئیات
          </Button>
          {canWrite && canRestoreRedirect(candidate) ? (
            <Button size="sm" onClick={() => openAction(candidate, 'REDIRECTED')}>
              بازیابی هدایت
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  const historyColumns: readonly DataTableColumn<AdminPaymentAttempt>[] = [
    {
      id: 'order',
      header: 'سفارش / مشتری',
      cell: (attempt) => (
        <div>
          <p className="font-bold">{toPersianDigits(attempt.payment.order.orderNumber)}</p>
          <p className="mt-1 text-xs text-[var(--admin-color-muted)]">{customerLabel(attempt)}</p>
        </div>
      ),
    },
    { id: 'provider', header: 'درگاه', cell: (attempt) => providerLabel(attempt.provider) },
    { id: 'amount', header: 'مبلغ', cell: (attempt) => formatAdminToman(attempt.amountToman) },
    {
      id: 'result',
      header: 'نتیجه',
      cell: (attempt) => <ResolutionBadge resolution={attempt.initiationRecoveryResolution} />,
    },
    {
      id: 'operator',
      header: 'اپراتور',
      cell: actorLabel,
      visibility: 'lg',
    },
    {
      id: 'actions',
      header: 'جزئیات',
      align: 'end',
      cell: (attempt) => (
        <Button size="sm" variant="outline" onClick={() => setHistoryDetails(attempt)}>
          مشاهده
        </Button>
      ),
    },
  ];

  if (failed || !summary) {
    return (
      <Alert tone="danger" title="دریافت صف بازیابی پرداخت ناموفق بود" className="mt-6">
        ارتباط با سرویس پرداخت را بررسی و صفحه را تازه‌سازی کنید.
      </Alert>
    );
  }

  return (
    <div className="space-y-6 pt-6">
      {success ? <Alert tone="success">{success}</Alert> : null}
      {!canWrite ? (
        <Alert tone="info">
          دسترسی شما فقط برای مشاهده است؛ عملیات recovery به مجوز «finance.write» نیاز دارد.
        </Alert>
      ) : null}
      <Alert tone="warning" title="پرداخت نامشخص را دستی تأیید یا تکرار نکنید">
        ابتدا نتیجه شروع پرداخت را در پنل درگاه بررسی کنید. این جریان فقط پاسخ initiation را بازیابی
        یا تلاش بدون تراکنش را مختومه می‌کند و هرگز پرداخت را تأیید نمی‌کند.
      </Alert>

      <section
        aria-label="شاخص‌های بازیابی پرداخت"
        className="grid grid-cols-2 gap-3 lg:grid-cols-4"
      >
        <KpiCard
          label="صف فعال"
          value={candidates.length}
          tone={candidates.length ? 'warning' : 'neutral'}
        />
        <KpiCard
          label="موارد بحرانی"
          value={escalatedCount}
          tone={escalatedCount ? 'danger' : 'neutral'}
        />
        <KpiCard
          label="قابل بازیابی"
          value={restorableCount}
          tone={restorableCount ? 'success' : 'neutral'}
        />
        <KpiCard label="سابقه تعیین تکلیف" value={history.length} />
      </section>

      <Card title="وضعیت عملیات recovery" description="صف فعال و نتیجه اقدامات ثبت‌شده اپراتورها">
        <DonutChart
          title="وضعیت عملیات recovery"
          segments={[
            { label: 'فعال', value: candidates.length, color: 'var(--admin-color-warning)' },
            {
              label: 'هدایت بازیابی‌شده',
              value: redirectedCount,
              color: 'var(--admin-color-success)',
            },
            { label: 'مختومه', value: abandonedCount, color: 'var(--admin-color-muted)' },
          ]}
        />
        <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--admin-color-border)] pt-4">
          {Object.entries(summary.byProvider.stuckInitiations).map(([gateway, count]) => (
            <Badge key={gateway} tone="neutral">
              {providerLabel(gateway)}: {formatAdminInteger(count)} مورد فعال
            </Badge>
          ))}
          <span className="ms-auto text-xs text-[var(--admin-color-subtle)]">
            به‌روزرسانی: {formatAdminDateTime(summary.generatedAt)}
          </span>
        </div>
      </Card>

      <Card>
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="صف‌های بازیابی پرداخت">
          <Button
            role="tab"
            aria-selected={queue === 'active'}
            variant={queue === 'active' ? 'primary' : 'outline'}
            onClick={() => setQueue('active')}
          >
            صف فعال ({formatAdminInteger(candidates.length)})
          </Button>
          <Button
            role="tab"
            aria-selected={queue === 'history'}
            variant={queue === 'history' ? 'primary' : 'outline'}
            onClick={() => setQueue('history')}
          >
            سابقه عملیات ({formatAdminInteger(history.length)})
          </Button>
        </div>
      </Card>

      <FilterBar
        activeCount={activeFilterCount}
        resetAction={
          activeFilterCount ? (
            <Button size="sm" variant="ghost" onClick={resetFilters}>
              پاک‌کردن فیلترها
            </Button>
          ) : undefined
        }
      >
        <SearchField
          aria-label="جستجوی بازیابی پرداخت"
          placeholder="شماره سفارش، مشتری، موبایل، تلاش یا Authority"
          value={search}
          onChange={(event) => setSearch(toPersianDigits(event.target.value))}
        />
        <Select
          aria-label="فیلتر درگاه بازیابی"
          value={provider}
          onValueChange={setProvider}
          options={[
            { value: 'all', label: 'همه درگاه‌ها' },
            ...providers.map((value) => ({ value, label: providerLabel(value) })),
          ]}
        />
        {queue === 'history' ? (
          <Select
            aria-label="فیلتر نتیجه بازیابی"
            value={resolution}
            onValueChange={(value) => setResolution(value as ResolutionFilter)}
            options={[
              { value: 'all', label: 'همه نتایج' },
              { value: 'REDIRECTED', label: 'هدایت بازیابی‌شده' },
              { value: 'ABANDONED', label: 'مختومه‌شده' },
            ]}
          />
        ) : null}
      </FilterBar>

      {queue === 'active' ? (
        <ResponsiveDataView
          caption="صف فعال بازیابی پرداخت"
          mobileLabel="کارت‌های صف فعال بازیابی"
          columns={activeColumns}
          rows={filteredCandidates}
          getRowKey={(candidate) => candidate.id}
          emptyTitle={activeFilterCount ? 'نتیجه‌ای پیدا نشد' : 'صف بازیابی خالی است'}
          emptyDescription={
            activeFilterCount
              ? 'عبارت جستجو یا فیلتر درگاه را تغییر دهید.'
              : 'هیچ شروع پرداخت نامشخصی از آستانه بررسی عبور نکرده است.'
          }
          renderMobileCard={(candidate) => (
            <MobileDataCard
              detailsOpen={mobileDetailsId === candidate.id}
              onDetailsOpenChange={(open) => setMobileDetailsId(open ? candidate.id : null)}
              title={toPersianDigits(candidate.payment.order.orderNumber)}
              eyebrow={providerLabel(candidate.provider)}
              status={<PriorityBadge createdAt={candidate.createdAt} />}
              items={[
                { label: 'مبلغ', value: formatAdminToman(candidate.amountToman) },
                {
                  label: 'امکان هدایت',
                  value: canRestoreRedirect(candidate) ? 'قابل بازیابی' : 'غیرقابل بازیابی',
                },
                { label: 'وضعیت سفارش', value: orderStatusLabel(candidate.payment.order.status) },
                { label: 'زمان ایجاد', value: formatAdminDateTime(candidate.createdAt) },
              ]}
              detailsTitle={`تلاش سفارش ${toPersianDigits(candidate.payment.order.orderNumber)}`}
              details={<CandidateDetails candidate={candidate} />}
              detailsFooter={
                canWrite ? (
                  <div className="flex w-full gap-2">
                    {canRestoreRedirect(candidate) ? (
                      <Button
                        className="flex-1"
                        onClick={() => openAction(candidate, 'REDIRECTED')}
                      >
                        بازیابی هدایت
                      </Button>
                    ) : null}
                    <Button
                      className="flex-1"
                      variant="danger"
                      onClick={() => openAction(candidate, 'ABANDONED')}
                    >
                      مختومه‌کردن
                    </Button>
                  </div>
                ) : undefined
              }
            />
          )}
        />
      ) : (
        <ResponsiveDataView
          caption="سابقه بازیابی پرداخت"
          mobileLabel="کارت‌های سابقه بازیابی"
          columns={historyColumns}
          rows={filteredHistory}
          getRowKey={(attempt) => attempt.id}
          emptyTitle={activeFilterCount ? 'نتیجه‌ای پیدا نشد' : 'سابقه‌ای ثبت نشده است'}
          emptyDescription={
            activeFilterCount
              ? 'عبارت جستجو یا فیلترها را تغییر دهید.'
              : 'اقدامات تعیین تکلیف‌شده در این بخش نمایش داده می‌شوند.'
          }
          renderMobileCard={(attempt) => (
            <MobileDataCard
              detailsOpen={mobileDetailsId === attempt.id}
              onDetailsOpenChange={(open) => setMobileDetailsId(open ? attempt.id : null)}
              title={toPersianDigits(attempt.payment.order.orderNumber)}
              eyebrow={providerLabel(attempt.provider)}
              status={<ResolutionBadge resolution={attempt.initiationRecoveryResolution} />}
              items={[
                { label: 'مبلغ', value: formatAdminToman(attempt.amountToman) },
                { label: 'مشتری', value: customerLabel(attempt) },
                { label: 'اپراتور', value: actorLabel(attempt) },
                {
                  label: 'زمان نتیجه',
                  value: attempt.initiationRecoveryResolvedAt
                    ? formatAdminDateTime(attempt.initiationRecoveryResolvedAt)
                    : 'ثبت نشده',
                },
              ]}
              detailsTitle={`سابقه سفارش ${toPersianDigits(attempt.payment.order.orderNumber)}`}
              details={<HistoryDetails attempt={attempt} />}
            />
          )}
        />
      )}

      <Dialog
        open={candidateDetails !== null}
        onOpenChange={(open) => !open && setCandidateDetails(null)}
      >
        {candidateDetails ? (
          <DialogContent
            size="lg"
            title={`تلاش سفارش ${toPersianDigits(candidateDetails.payment.order.orderNumber)}`}
            description="مبلغ، وضعیت سفارش و انقضای رزرو را پیش از تصمیم بررسی کنید."
            footer={
              canWrite ? (
                <>
                  <Button
                    variant="danger"
                    onClick={() => openAction(candidateDetails, 'ABANDONED')}
                  >
                    مختومه‌کردن
                  </Button>
                  {canRestoreRedirect(candidateDetails) ? (
                    <Button onClick={() => openAction(candidateDetails, 'REDIRECTED')}>
                      بازیابی هدایت
                    </Button>
                  ) : null}
                </>
              ) : undefined
            }
          >
            <CandidateDetails candidate={candidateDetails} />
          </DialogContent>
        ) : null}
      </Dialog>

      <Dialog
        open={historyDetails !== null}
        onOpenChange={(open) => !open && setHistoryDetails(null)}
      >
        {historyDetails ? (
          <DialogContent
            size="lg"
            title={`سابقه سفارش ${toPersianDigits(historyDetails.payment.order.orderNumber)}`}
            description="شواهد و نتیجه ثبت‌شده عملیات recovery"
          >
            <HistoryDetails attempt={historyDetails} />
          </DialogContent>
        ) : null}
      </Dialog>

      <Dialog
        open={action !== null}
        onOpenChange={(open) => {
          if (!open) closeAction();
        }}
      >
        {action ? (
          <DialogContent
            title={
              action.resolution === 'REDIRECTED' ? 'بازیابی هدایت به درگاه' : 'مختومه‌کردن تلاش'
            }
            description={`سفارش ${toPersianDigits(action.candidate.payment.order.orderNumber)}`}
            hideClose={pending}
            footer={
              <>
                <Button variant="outline" disabled={pending} onClick={closeAction}>
                  انصراف
                </Button>
                <Button
                  type="submit"
                  form="payment-recovery-form"
                  variant={action.resolution === 'ABANDONED' ? 'danger' : 'primary'}
                  loading={pending}
                >
                  تأیید نهایی
                </Button>
              </>
            }
          >
            <form id="payment-recovery-form" className="space-y-4" onSubmit={submitAction}>
              {action.resolution === 'REDIRECTED' ? (
                <>
                  <Alert tone="warning">
                    Authority و URL را عیناً از پاسخ یا پنل همان درگاه وارد کنید. Backend نشانی
                    canonical و وضعیت قابل‌پرداخت سفارش را دوباره کنترل می‌کند.
                  </Alert>
                  <FormField id="recovery-authority" label="شناسه Authority" required>
                    {(controlProps) => (
                      <Input
                        {...controlProps}
                        dir="ltr"
                        value={authority}
                        maxLength={255}
                        placeholder="Authority یا شناسه شروع درگاه"
                        disabled={pending}
                        onChange={(event) => setAuthority(toPersianDigits(event.target.value))}
                      />
                    )}
                  </FormField>
                  <FormField id="recovery-payment-url" label="نشانی پرداخت" required>
                    {(controlProps) => (
                      <Input
                        {...controlProps}
                        dir="ltr"
                        type="url"
                        value={paymentUrl}
                        maxLength={2000}
                        placeholder="https://gateway.example/..."
                        disabled={pending}
                        onChange={(event) => setPaymentUrl(event.target.value)}
                      />
                    )}
                  </FormField>
                </>
              ) : (
                <Alert tone="danger" title="این عملیات برگشت‌پذیر نیست">
                  فقط پس از اطمینان از ساخته‌نشدن تراکنش در پنل درگاه، تلاش را مختومه کنید.
                </Alert>
              )}
              <FormField
                id="payment-recovery-note"
                label="یادداشت بررسی"
                required
                error={error || undefined}
                hint="نتیجه بررسی پنل درگاه و دلیل تصمیم را ثبت کنید."
              >
                {(controlProps) => (
                  <Textarea
                    {...controlProps}
                    value={note}
                    maxLength={400}
                    placeholder="شرح بررسی درگاه و مستند تصمیم"
                    disabled={pending}
                    onChange={(event) => setNote(toPersianDigits(event.target.value))}
                  />
                )}
              </FormField>
            </form>
          </DialogContent>
        ) : null}
      </Dialog>
    </div>
  );
}
