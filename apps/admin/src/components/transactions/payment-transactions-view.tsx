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
  PAYMENT_ATTEMPT_STATUSES,
  parsePaymentAttemptPage,
  paymentAttemptNeedsReview,
  type AdminPaymentAttempt,
  type AdminPaymentAttemptPage,
  type AdminPaymentAttemptStatus,
} from '@/lib/transactions/payment-transactions-model';

type PaymentTransactionsViewProps = Readonly<{
  initialPage: AdminPaymentAttemptPage | null;
  failed: boolean;
}>;

type AttentionFilter = 'all' | 'review' | 'errors' | 'verified';

const EMPTY_ATTEMPTS: readonly AdminPaymentAttempt[] = [];

const STATUS_PRESENTATION: Record<
  AdminPaymentAttemptStatus,
  Readonly<{ label: string; tone: BadgeTone; color: string }>
> = {
  CREATED: { label: 'ایجادشده', tone: 'warning', color: '#f59e0b' },
  REDIRECTED: { label: 'هدایت‌شده', tone: 'info', color: '#2563eb' },
  VERIFIED: { label: 'تأییدشده', tone: 'success', color: '#059669' },
  FAILED: { label: 'ناموفق', tone: 'danger', color: '#dc2626' },
  RECONCILIATION_REQUIRED: {
    label: 'نیازمند مغایرت‌گیری',
    tone: 'danger',
    color: '#be123c',
  },
  RECONCILED: { label: 'تعیین تکلیف‌شده', tone: 'neutral', color: '#64748b' },
};

const PROVIDER_LABELS: Readonly<Record<string, string>> = {
  zarinpal: 'زرین‌پال',
  zibal: 'زیبال',
  mellat: 'بانک ملت',
};

function providerLabel(provider: string): string {
  return PROVIDER_LABELS[provider] ?? toPersianDigits(provider);
}

function customerName(attempt: AdminPaymentAttempt): string {
  const { firstName, lastName } = attempt.payment.order.user;
  return [firstName, lastName].filter(Boolean).join(' ') || 'بدون نام';
}

function StatusBadge({ attempt }: Readonly<{ attempt: AdminPaymentAttempt }>) {
  const presentation = STATUS_PRESENTATION[attempt.status];
  return (
    <Badge tone={presentation.tone} dot>
      {presentation.label}
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

function TransactionDetails({ attempt }: Readonly<{ attempt: AdminPaymentAttempt }>) {
  const recoveryActor = attempt.initiationRecoveryResolvedBy;
  const recoveryActorName = recoveryActor
    ? [recoveryActor.firstName, recoveryActor.lastName].filter(Boolean).join(' ') ||
      formatAdminPhone(recoveryActor.phone)
    : 'ثبت نشده';

  return (
    <div className="space-y-4">
      {attempt.failureCode || attempt.failureMessage ? (
        <Alert tone="danger" title="خطای ثبت‌شده درگاه">
          <p>{toPersianDigits(attempt.failureMessage ?? 'پیام خطا ثبت نشده')}</p>
          {attempt.failureCode ? (
            <p className="mt-1 text-xs">کد خطا: {toPersianDigits(attempt.failureCode)}</p>
          ) : null}
        </Alert>
      ) : null}

      {paymentAttemptNeedsReview(attempt) ? (
        <Alert
          tone="warning"
          title="نیازمند بررسی عملیاتی"
          action={
            <ButtonLink
              href={attempt.reconciliation ? '/reconciliations' : '/payments'}
              size="sm"
              variant="outline"
            >
              ورود به صف بررسی
            </ButtonLink>
          }
        >
          برای تغییر وضعیت از فرایند کنترل‌شده مغایرت یا بازیابی استفاده کنید.
        </Alert>
      ) : null}

      <DetailRows
        rows={[
          ['شناسه تلاش', attempt.id],
          ['سفارش', attempt.payment.order.orderNumber],
          ['مشتری', customerName(attempt)],
          ['شماره همراه', formatAdminPhone(attempt.payment.order.user.phone)],
          ['درگاه', providerLabel(attempt.provider)],
          ['وضعیت تلاش', STATUS_PRESENTATION[attempt.status].label],
          ['وضعیت پرداخت', attempt.payment.status],
          ['وضعیت سفارش', attempt.payment.order.status],
          ['مبلغ تلاش', formatAdminToman(attempt.amountToman)],
          ['مبلغ سفارش', formatAdminToman(attempt.payment.order.grandTotalToman)],
          ['Authority', attempt.authority ?? 'ثبت نشده'],
          ['مرجع درگاه', attempt.providerReference ?? 'ثبت نشده'],
          ['زمان ایجاد', formatAdminDateTime(attempt.createdAt)],
          ['آخرین تغییر', formatAdminDateTime(attempt.updatedAt)],
          ['زمان تأیید', attempt.verifiedAt ? formatAdminDateTime(attempt.verifiedAt) : 'ثبت نشده'],
        ]}
      />

      {attempt.initiationRecoveryResolution ? (
        <Card title="سابقه بازیابی پرداخت">
          <DetailRows
            rows={[
              ['نتیجه', attempt.initiationRecoveryResolution],
              ['اپراتور', recoveryActorName],
              [
                'زمان ثبت',
                attempt.initiationRecoveryResolvedAt
                  ? formatAdminDateTime(attempt.initiationRecoveryResolvedAt)
                  : 'ثبت نشده',
              ],
              ['یادداشت', attempt.initiationRecoveryNote ?? 'ثبت نشده'],
            ]}
          />
        </Card>
      ) : null}

      {attempt.reconciliation ? (
        <Card title="سابقه مغایرت">
          <DetailRows
            rows={[
              ['وضعیت', attempt.reconciliation.status],
              ['علت', attempt.reconciliation.reason],
              ['نتیجه', attempt.reconciliation.resolution ?? 'ثبت نشده'],
              ['مرجع خارجی', attempt.reconciliation.externalReference ?? 'ثبت نشده'],
              [
                'زمان رفع',
                attempt.reconciliation.resolvedAt
                  ? formatAdminDateTime(attempt.reconciliation.resolvedAt)
                  : 'ثبت نشده',
              ],
            ]}
          />
        </Card>
      ) : null}
    </div>
  );
}

function KpiCard({ label, value }: Readonly<{ label: string; value: string | number }>) {
  return (
    <Card>
      <p className="text-xs text-[var(--admin-color-muted)]">{label}</p>
      <p className="mt-2 text-2xl font-black">
        {typeof value === 'number' ? formatAdminInteger(value) : value}
      </p>
    </Card>
  );
}

export function PaymentTransactionsView({ initialPage, failed }: PaymentTransactionsViewProps) {
  const [data, setData] = useState(initialPage);
  const [search, setSearch] = useState('');
  const [provider, setProvider] = useState('all');
  const [status, setStatus] = useState('all');
  const [attention, setAttention] = useState<AttentionFilter>('all');
  const [activeAttempt, setActiveAttempt] = useState<AdminPaymentAttempt | null>(null);
  const [mobileDetailsId, setMobileDetailsId] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState('');

  const attempts = data?.items ?? EMPTY_ATTEMPTS;
  const normalizedSearch = toAsciiDigits(search).trim().toLocaleLowerCase('fa');
  const providers = useMemo(
    () => [
      ...new Set([
        ...Object.keys(data?.summary.byProvider ?? {}),
        ...attempts.map((row) => row.provider),
      ]),
    ],
    [attempts, data?.summary.byProvider],
  );
  const filtered = useMemo(
    () =>
      attempts.filter((attempt) => {
        if (provider !== 'all' && attempt.provider !== provider) return false;
        if (status !== 'all' && attempt.status !== status) return false;
        if (attention === 'review' && !paymentAttemptNeedsReview(attempt)) return false;
        if (attention === 'errors' && !attempt.failureCode && !attempt.failureMessage) return false;
        if (attention === 'verified' && attempt.status !== 'VERIFIED') return false;
        if (!normalizedSearch) return true;
        return [
          attempt.id,
          attempt.payment.order.orderNumber,
          customerName(attempt),
          attempt.payment.order.user.phone,
          attempt.provider,
          attempt.authority,
          attempt.providerReference,
          attempt.failureCode,
          attempt.failureMessage,
        ].some((value) =>
          value ? toAsciiDigits(value).toLocaleLowerCase('fa').includes(normalizedSearch) : false,
        );
      }),
    [attempts, attention, normalizedSearch, provider, status],
  );
  const reviewCount = attempts.filter((attempt) => paymentAttemptNeedsReview(attempt)).length;
  const activeFilterCount =
    Number(Boolean(search.trim())) +
    Number(provider !== 'all') +
    Number(status !== 'all') +
    Number(attention !== 'all');

  const columns: readonly DataTableColumn<AdminPaymentAttempt>[] = [
    {
      id: 'order',
      header: 'سفارش / مشتری',
      cell: (attempt) => (
        <div>
          <p className="font-bold">{toPersianDigits(attempt.payment.order.orderNumber)}</p>
          <p className="mt-1 text-xs text-[var(--admin-color-muted)]">
            {customerName(attempt)} · {formatAdminPhone(attempt.payment.order.user.phone)}
          </p>
        </div>
      ),
    },
    {
      id: 'provider',
      header: 'درگاه / مرجع',
      cell: (attempt) => (
        <div>
          <p>{providerLabel(attempt.provider)}</p>
          <p className="mt-1 max-w-44 truncate text-xs text-[var(--admin-color-muted)]">
            {toPersianDigits(attempt.providerReference ?? attempt.authority ?? 'بدون مرجع')}
          </p>
        </div>
      ),
    },
    { id: 'amount', header: 'مبلغ', cell: (attempt) => formatAdminToman(attempt.amountToman) },
    {
      id: 'status',
      header: 'وضعیت',
      cell: (attempt) => <StatusBadge attempt={attempt} />,
    },
    {
      id: 'date',
      header: 'زمان',
      cell: (attempt) => formatAdminDateTime(attempt.createdAt),
      visibility: 'lg',
    },
    {
      id: 'action',
      header: 'جزئیات',
      align: 'end',
      cell: (attempt) => (
        <Button size="sm" variant="outline" onClick={() => setActiveAttempt(attempt)}>
          مشاهده
        </Button>
      ),
    },
  ];

  function resetFilters() {
    setSearch('');
    setProvider('all');
    setStatus('all');
    setAttention('all');
  }

  async function loadMore() {
    if (!data || data.page >= data.pageCount || loadingMore) return;
    setLoadingMore(true);
    setLoadError('');
    try {
      const response = await fetch(
        `/api/payment-transactions?page=${data.page + 1}&pageSize=${data.pageSize}`,
      );
      const payload = (await response.json().catch(() => null)) as unknown;
      const nextPage = response.ok ? parsePaymentAttemptPage(payload) : null;
      if (!nextPage) throw new Error('invalid response');
      const byId = new Map([...data.items, ...nextPage.items].map((item) => [item.id, item]));
      setData({ ...nextPage, items: [...byId.values()] });
    } catch {
      setLoadError('دریافت تراکنش‌های بیشتر انجام نشد. دوباره تلاش کنید.');
    } finally {
      setLoadingMore(false);
    }
  }

  if (failed || !initialPage || !data) {
    return (
      <Alert tone="danger" title="دریافت تراکنش‌ها ناموفق بود" className="mt-6">
        ارتباط با سرویس پرداخت برقرار نشد. صفحه را دوباره بارگذاری کنید.
      </Alert>
    );
  }

  const statusSegments = PAYMENT_ATTEMPT_STATUSES.map((attemptStatus) => ({
    label: STATUS_PRESENTATION[attemptStatus].label,
    value: data.summary.byStatus[attemptStatus] ?? 0,
    color: STATUS_PRESENTATION[attemptStatus].color,
  }));

  return (
    <div className="space-y-6 pt-6">
      <Alert
        tone={reviewCount ? 'warning' : 'info'}
        title="تأیید پرداخت فقط از callback معتبر درگاه انجام می‌شود"
        action={
          <ButtonLink href="/payments" variant="outline" size="sm">
            صف بازیابی پرداخت
          </ButtonLink>
        }
      >
        این صفحه برای مشاهده و عیب‌یابی است؛ هیچ تراکنشی از اینجا به‌صورت دستی تأیید نمی‌شود.
      </Alert>

      <section aria-label="شاخص‌های تراکنش" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="کل تراکنش‌ها" value={data.total} />
        <KpiCard label="مبلغ کل تلاش‌ها" value={formatAdminToman(data.summary.totalAmountToman)} />
        <KpiCard label="تأییدشده" value={data.summary.byStatus.VERIFIED ?? 0} />
        <KpiCard label="نیازمند بررسی بارگذاری‌شده" value={reviewCount} />
      </section>

      <Card title="توزیع وضعیت تراکنش‌ها" description="براساس تمام نتایج موجود در سرویس پرداخت">
        <DonutChart title="توزیع وضعیت تراکنش‌ها" segments={statusSegments} />
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
          aria-label="جستجوی تراکنش"
          placeholder="شماره سفارش، مشتری، موبایل، مرجع یا خطا"
          value={search}
          onChange={(event) => setSearch(toPersianDigits(event.target.value))}
        />
        <Select
          aria-label="فیلتر درگاه"
          value={provider}
          onValueChange={setProvider}
          options={[
            { value: 'all', label: 'همه درگاه‌ها' },
            ...providers.map((value) => ({ value, label: providerLabel(value) })),
          ]}
        />
        <Select
          aria-label="فیلتر وضعیت تراکنش"
          value={status}
          onValueChange={setStatus}
          options={[
            { value: 'all', label: 'همه وضعیت‌ها' },
            ...PAYMENT_ATTEMPT_STATUSES.map((value) => ({
              value,
              label: STATUS_PRESENTATION[value].label,
            })),
          ]}
        />
        <Select
          aria-label="فیلتر نیاز به بررسی"
          value={attention}
          onValueChange={(value) => setAttention(value as AttentionFilter)}
          options={[
            { value: 'all', label: 'همه نتایج' },
            { value: 'review', label: 'نیازمند بررسی' },
            { value: 'errors', label: 'دارای خطای درگاه' },
            { value: 'verified', label: 'فقط تأییدشده' },
          ]}
        />
      </FilterBar>

      {loadError ? <Alert tone="danger">{loadError}</Alert> : null}

      <ResponsiveDataView
        caption="فهرست تراکنش‌های پرداخت"
        mobileLabel="کارت‌های تراکنش پرداخت"
        columns={columns}
        rows={filtered}
        getRowKey={(attempt) => attempt.id}
        emptyTitle={activeFilterCount ? 'تراکنشی با این فیلتر پیدا نشد' : 'تراکنشی ثبت نشده است'}
        emptyDescription={activeFilterCount ? 'فیلترها یا عبارت جستجو را تغییر دهید.' : undefined}
        renderMobileCard={(attempt) => (
          <MobileDataCard
            title={toPersianDigits(attempt.payment.order.orderNumber)}
            eyebrow={`${providerLabel(attempt.provider)} · ${customerName(attempt)}`}
            status={<StatusBadge attempt={attempt} />}
            items={[
              { label: 'مبلغ', value: formatAdminToman(attempt.amountToman) },
              { label: 'موبایل', value: formatAdminPhone(attempt.payment.order.user.phone) },
              {
                label: 'مرجع',
                value: toPersianDigits(attempt.providerReference ?? attempt.authority ?? '—'),
              },
              { label: 'زمان', value: formatAdminDateTime(attempt.createdAt) },
            ]}
            detailsTitle={`تراکنش سفارش ${toPersianDigits(attempt.payment.order.orderNumber)}`}
            detailsDescription={`${providerLabel(attempt.provider)} · ${formatAdminToman(attempt.amountToman)}`}
            details={<TransactionDetails attempt={attempt} />}
            detailsOpen={mobileDetailsId === attempt.id}
            onDetailsOpenChange={(open) => setMobileDetailsId(open ? attempt.id : null)}
          />
        )}
      />

      {data.page < data.pageCount ? (
        <div className="flex justify-center">
          <Button variant="outline" loading={loadingMore} onClick={() => void loadMore()}>
            نمایش تراکنش‌های بیشتر
          </Button>
        </div>
      ) : (
        <p className="text-center text-xs text-[var(--admin-color-subtle)]">
          همه {formatAdminInteger(data.total)} تراکنش بارگذاری شده‌اند.
        </p>
      )}

      <Dialog
        open={activeAttempt !== null}
        onOpenChange={(open) => !open && setActiveAttempt(null)}
      >
        <DialogContent
          title={
            activeAttempt
              ? `تراکنش سفارش ${toPersianDigits(activeAttempt.payment.order.orderNumber)}`
              : 'جزئیات تراکنش'
          }
          description={
            activeAttempt
              ? `${providerLabel(activeAttempt.provider)} · ${formatAdminToman(activeAttempt.amountToman)}`
              : undefined
          }
        >
          {activeAttempt ? <TransactionDetails attempt={activeAttempt} /> : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
