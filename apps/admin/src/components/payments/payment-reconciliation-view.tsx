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
import type { PaymentReconciliation } from '@/lib/payments/payment-operations-model';
import {
  formatAdminDateTime,
  formatAdminInteger,
  formatAdminPhone,
  formatAdminToman,
  toAsciiDigits,
  toPersianDigits,
} from '@/lib/presentation/formatters';

type Props = Readonly<{
  reconciliations: readonly PaymentReconciliation[];
  failed: boolean;
  canWrite: boolean;
}>;

type StatusFilter = 'all' | PaymentReconciliation['status'];

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
  FAILED: 'ناموفق',
  CANCELLED: 'لغوشده',
  RECONCILIATION_REQUIRED: 'نیازمند تطبیق',
  PARTIALLY_REFUNDED: 'بخشی بازپرداخت‌شده',
  REFUNDED: 'بازپرداخت‌شده',
};

function orderStatusLabel(status: string) {
  return ORDER_STATUS_LABELS[status] ?? toPersianDigits(status);
}

function paymentStatusLabel(status: string) {
  return PAYMENT_STATUS_LABELS[status] ?? toPersianDigits(status);
}

function providerLabel(provider: string) {
  const labels: Readonly<Record<string, string>> = {
    zarinpal: 'زرین‌پال',
    zibal: 'زیبال',
    mellat: 'بانک ملت',
  };
  return labels[provider.toLocaleLowerCase('en')] ?? toPersianDigits(provider);
}

function actorLabel(actor: PaymentReconciliation['resolvedBy']) {
  if (!actor) return 'ثبت نشده';
  return (
    [actor.firstName, actor.lastName].filter(Boolean).join(' ') || formatAdminPhone(actor.phone)
  );
}

function isEscalated(row: PaymentReconciliation) {
  return row.status === 'OPEN' && Date.now() - new Date(row.createdAt).getTime() >= 30 * 60 * 1000;
}

function StatusBadge({ row }: Readonly<{ row: PaymentReconciliation }>) {
  if (row.status === 'RESOLVED') return <Badge tone="success">رفع‌شده</Badge>;
  if (isEscalated(row)) {
    return (
      <Badge tone="danger" dot>
        باز و بحرانی
      </Badge>
    );
  }
  return (
    <Badge tone="warning" dot>
      نیازمند بررسی
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

function ReconciliationDetails({ row }: Readonly<{ row: PaymentReconciliation }>) {
  return (
    <div className="space-y-4">
      <Alert tone={row.status === 'OPEN' ? 'warning' : 'success'} title="علت ثبت مغایرت">
        {toPersianDigits(row.reason)}
      </Alert>
      <DetailRows
        rows={[
          ['شناسه مغایرت', row.id],
          ['شماره سفارش', row.paymentAttempt.payment.order.orderNumber],
          ['درگاه', providerLabel(row.provider)],
          ['مرجع پرداخت', row.providerReference],
          ['Authority', row.paymentAttempt.authority ?? 'ثبت نشده'],
          ['شناسه تلاش', row.paymentAttempt.id],
          ['مبلغ مغایرت', formatAdminToman(row.amountToman)],
          ['مبلغ پرداخت', formatAdminToman(row.paymentAttempt.payment.amountToman)],
          ['وضعیت تلاش', row.paymentAttempt.status],
          ['وضعیت پرداخت', paymentStatusLabel(row.paymentAttempt.payment.status)],
          ['وضعیت سفارش هنگام تشخیص', orderStatusLabel(row.detectedOrderStatus)],
          ['وضعیت فعلی سفارش', orderStatusLabel(row.paymentAttempt.payment.order.status)],
          ['زمان شناسایی', formatAdminDateTime(row.createdAt)],
          ['آخرین تغییر', formatAdminDateTime(row.updatedAt)],
          [
            'زمان تأیید درگاه',
            row.paymentAttempt.verifiedAt
              ? formatAdminDateTime(row.paymentAttempt.verifiedAt)
              : 'ثبت نشده',
          ],
        ]}
      />
      {row.status === 'RESOLVED' ? (
        <Card title="سابقه رفع مغایرت">
          <DetailRows
            rows={[
              [
                'نتیجه',
                row.resolution === 'REFUNDED_EXTERNALLY'
                  ? 'بازپرداخت خارجی تأیید شد'
                  : (row.resolution ?? 'ثبت نشده'),
              ],
              ['مرجع خارجی', row.externalReference ?? 'ثبت نشده'],
              ['اپراتور', actorLabel(row.resolvedBy)],
              ['زمان رفع', row.resolvedAt ? formatAdminDateTime(row.resolvedAt) : 'ثبت نشده'],
              ['یادداشت بررسی', row.resolutionNote ?? 'ثبت نشده'],
            ]}
          />
        </Card>
      ) : null}
    </div>
  );
}

function KpiCard({
  label,
  value,
  tone = 'neutral',
}: Readonly<{
  label: string;
  value: number | string;
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
      <p className={`mt-2 text-2xl font-black ${toneClass}`}>
        {typeof value === 'number' ? formatAdminInteger(value) : value}
      </p>
    </Card>
  );
}

function mutationErrorMessage(status: number) {
  if (status === 401) return 'نشست مدیریتی منقضی شده است. دوباره وارد شوید.';
  if (status === 403) return 'مجوز رفع مغایرت را ندارید.';
  if (status === 404) return 'مغایرت پیدا نشد یا دیگر در دسترس نیست.';
  if (status === 409) return 'این مغایرت هم‌زمان تغییر کرده است؛ صفحه را تازه‌سازی کنید.';
  if (status === 400 || status === 422)
    return 'اطلاعات واردشده معتبر نیست یا وضعیت پرداخت اجازه این عملیات را نمی‌دهد.';
  return 'رفع مغایرت انجام نشد. دوباره تلاش کنید.';
}

export function PaymentReconciliationView({ reconciliations, failed, canWrite }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [provider, setProvider] = useState('all');
  const [mobileDetailsId, setMobileDetailsId] = useState<string | null>(null);
  const [desktopDetails, setDesktopDetails] = useState<PaymentReconciliation | null>(null);
  const [action, setAction] = useState<PaymentReconciliation | null>(null);
  const [externalReference, setExternalReference] = useState('');
  const [note, setNote] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const providers = useMemo(
    () => [...new Set(reconciliations.map((row) => row.provider))],
    [reconciliations],
  );
  const needle = toAsciiDigits(search).trim().toLocaleLowerCase('fa');
  const filtered = useMemo(
    () =>
      reconciliations.filter((row) => {
        if (status !== 'all' && row.status !== status) return false;
        if (provider !== 'all' && row.provider !== provider) return false;
        if (!needle) return true;
        return [
          row.id,
          row.paymentAttempt.id,
          row.paymentAttempt.payment.order.orderNumber,
          row.provider,
          row.providerReference,
          row.paymentAttempt.authority,
          row.externalReference,
          row.reason,
          row.resolutionNote,
          actorLabel(row.resolvedBy),
        ].some((value) =>
          value ? toAsciiDigits(value).toLocaleLowerCase('fa').includes(needle) : false,
        );
      }),
    [needle, provider, reconciliations, status],
  );
  const openCount = reconciliations.filter((row) => row.status === 'OPEN').length;
  const resolvedCount = reconciliations.length - openCount;
  const escalatedCount = reconciliations.filter(isEscalated).length;
  const openAmount = reconciliations
    .filter((row) => row.status === 'OPEN')
    .reduce((sum, row) => sum + row.amountToman, 0);
  const activeFilterCount =
    Number(Boolean(search.trim())) + Number(status !== 'all') + Number(provider !== 'all');

  function resetFilters() {
    setSearch('');
    setStatus('all');
    setProvider('all');
  }

  function openResolution(row: PaymentReconciliation) {
    setDesktopDetails(null);
    setMobileDetailsId(null);
    setAction(row);
    setExternalReference('');
    setNote('');
    setError('');
  }

  async function submitResolution(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!action || pending) return;
    const reference = toAsciiDigits(externalReference).trim();
    const resolutionNote = note.trim();
    if (!reference) {
      setError('مرجع بازپرداخت خارجی الزامی است.');
      return;
    }
    if (resolutionNote.length < 3) {
      setError('یادداشت بررسی باید حداقل ۳ نویسه باشد.');
      return;
    }

    setPending(true);
    setError('');
    try {
      const response = await fetch(
        `/api/payments/reconciliations/${encodeURIComponent(action.id)}/resolve-external-refund`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            externalRefundReference: reference,
            resolutionNote,
          }),
        },
      );
      if (!response.ok) {
        setError(mutationErrorMessage(response.status));
        return;
      }
      setAction(null);
      setSuccess('مغایرت با مرجع و مستندات اپراتور رفع شد.');
      router.refresh();
    } catch {
      setError('ارتباط با سرور برقرار نشد. دوباره تلاش کنید.');
    } finally {
      setPending(false);
    }
  }

  const columns: readonly DataTableColumn<PaymentReconciliation>[] = [
    {
      id: 'order',
      header: 'سفارش',
      cell: (row) => (
        <div>
          <p className="font-bold">
            {toPersianDigits(row.paymentAttempt.payment.order.orderNumber)}
          </p>
          <p className="mt-1 text-xs text-[var(--admin-color-muted)]">
            {formatAdminDateTime(row.createdAt)}
          </p>
        </div>
      ),
    },
    {
      id: 'provider',
      header: 'درگاه / مرجع',
      cell: (row) => (
        <div>
          <p>{providerLabel(row.provider)}</p>
          <p className="mt-1 max-w-44 truncate text-xs text-[var(--admin-color-muted)]">
            {toPersianDigits(row.providerReference)}
          </p>
        </div>
      ),
    },
    { id: 'amount', header: 'مبلغ', cell: (row) => formatAdminToman(row.amountToman) },
    {
      id: 'reason',
      header: 'علت مغایرت',
      cell: (row) => <p className="max-w-64 line-clamp-2">{toPersianDigits(row.reason)}</p>,
      visibility: 'lg',
    },
    { id: 'status', header: 'وضعیت', cell: (row) => <StatusBadge row={row} /> },
    {
      id: 'actions',
      header: 'عملیات',
      align: 'end',
      cell: (row) => (
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={() => setDesktopDetails(row)}>
            جزئیات
          </Button>
          {row.status === 'OPEN' && canWrite ? (
            <Button size="sm" onClick={() => openResolution(row)}>
              رفع مغایرت
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  if (failed) {
    return (
      <Alert tone="danger" title="دریافت مغایرت‌های پرداخت ناموفق بود" className="mt-6">
        ارتباط با سرویس پرداخت را بررسی و صفحه را تازه‌سازی کنید.
      </Alert>
    );
  }

  return (
    <div className="space-y-6 pt-6">
      {success ? <Alert tone="success">{success}</Alert> : null}
      {!canWrite ? (
        <Alert tone="info">
          دسترسی شما فقط برای مشاهده است؛ رفع مغایرت به مجوز «finance.write» نیاز دارد.
        </Alert>
      ) : null}

      <section
        aria-label="شاخص‌های مغایرت پرداخت"
        className="grid grid-cols-2 gap-3 lg:grid-cols-4"
      >
        <KpiCard label="کل مغایرت‌ها" value={reconciliations.length} />
        <KpiCard label="مغایرت باز" value={openCount} tone={openCount ? 'warning' : 'neutral'} />
        <KpiCard
          label="موارد بحرانی"
          value={escalatedCount}
          tone={escalatedCount ? 'danger' : 'neutral'}
        />
        <KpiCard
          label="مبلغ باز"
          value={formatAdminToman(openAmount)}
          tone={openAmount ? 'warning' : 'neutral'}
        />
      </section>

      <Card
        title="توزیع وضعیت مغایرت‌ها"
        description="نمای کلی صف باز و سابقه موارد تعیین‌تکلیف‌شده"
      >
        <DonutChart
          title="توزیع وضعیت مغایرت‌ها"
          segments={[
            { label: 'باز', value: openCount, color: 'var(--admin-color-warning)' },
            { label: 'رفع‌شده', value: resolvedCount, color: 'var(--admin-color-success)' },
          ]}
        />
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
          aria-label="جستجوی مغایرت"
          placeholder="شماره سفارش، مرجع، Authority، علت یا اپراتور"
          value={search}
          onChange={(event) => setSearch(toPersianDigits(event.target.value))}
        />
        <Select
          aria-label="فیلتر وضعیت مغایرت"
          value={status}
          onValueChange={(value) => setStatus(value as StatusFilter)}
          options={[
            { value: 'all', label: 'همه وضعیت‌ها' },
            { value: 'OPEN', label: 'باز' },
            { value: 'RESOLVED', label: 'رفع‌شده' },
          ]}
        />
        <Select
          aria-label="فیلتر درگاه مغایرت"
          value={provider}
          onValueChange={setProvider}
          options={[
            { value: 'all', label: 'همه درگاه‌ها' },
            ...providers.map((value) => ({ value, label: providerLabel(value) })),
          ]}
        />
      </FilterBar>

      <ResponsiveDataView
        caption="صف مغایرت‌های پرداخت"
        mobileLabel="کارت‌های مغایرت پرداخت"
        columns={columns}
        rows={filtered}
        getRowKey={(row) => row.id}
        emptyTitle={activeFilterCount ? 'نتیجه‌ای پیدا نشد' : 'مغایرتی ثبت نشده است'}
        emptyDescription={
          activeFilterCount
            ? 'عبارت جستجو یا فیلترها را تغییر دهید.'
            : 'در حال حاضر سابقه‌ای برای تطبیق پرداخت وجود ندارد.'
        }
        renderMobileCard={(row) => (
          <MobileDataCard
            detailsOpen={mobileDetailsId === row.id}
            onDetailsOpenChange={(open) => setMobileDetailsId(open ? row.id : null)}
            title={toPersianDigits(row.paymentAttempt.payment.order.orderNumber)}
            eyebrow={providerLabel(row.provider)}
            status={<StatusBadge row={row} />}
            items={[
              { label: 'مبلغ', value: formatAdminToman(row.amountToman) },
              { label: 'مرجع درگاه', value: toPersianDigits(row.providerReference) },
              {
                label: 'وضعیت سفارش',
                value: orderStatusLabel(row.paymentAttempt.payment.order.status),
              },
              { label: 'شناسایی', value: formatAdminDateTime(row.createdAt) },
            ]}
            detailsTitle={`مغایرت سفارش ${toPersianDigits(row.paymentAttempt.payment.order.orderNumber)}`}
            details={<ReconciliationDetails row={row} />}
            detailsFooter={
              row.status === 'OPEN' && canWrite ? (
                <Button className="w-full" onClick={() => openResolution(row)}>
                  رفع مغایرت
                </Button>
              ) : undefined
            }
          />
        )}
      />

      <Dialog
        open={desktopDetails !== null}
        onOpenChange={(open) => !open && setDesktopDetails(null)}
      >
        {desktopDetails ? (
          <DialogContent
            size="lg"
            title={`مغایرت سفارش ${toPersianDigits(desktopDetails.paymentAttempt.payment.order.orderNumber)}`}
            description="اطلاعات ثبت‌شده را با گزارش درگاه تطبیق دهید."
            footer={
              desktopDetails.status === 'OPEN' && canWrite ? (
                <Button onClick={() => openResolution(desktopDetails)}>رفع مغایرت</Button>
              ) : undefined
            }
          >
            <ReconciliationDetails row={desktopDetails} />
          </DialogContent>
        ) : null}
      </Dialog>

      <Dialog
        open={action !== null}
        onOpenChange={(open) => {
          if (!open && !pending) setAction(null);
        }}
      >
        {action ? (
          <DialogContent
            title="ثبت رفع مغایرت"
            description={`سفارش ${toPersianDigits(action.paymentAttempt.payment.order.orderNumber)}`}
            hideClose={pending}
            footer={
              <>
                <Button variant="outline" disabled={pending} onClick={() => setAction(null)}>
                  انصراف
                </Button>
                <Button type="submit" form="reconciliation-resolution-form" loading={pending}>
                  تأیید نهایی
                </Button>
              </>
            }
          >
            <form
              id="reconciliation-resolution-form"
              className="space-y-4"
              onSubmit={submitResolution}
            >
              <Alert tone="danger" title="ابتدا بازپرداخت را در پنل درگاه بررسی کنید">
                این عملیات وجهی جابه‌جا نمی‌کند؛ فقط بازپرداختی را ثبت کنید که خارج از سامانه انجام
                و با مرجع معتبر تأیید شده است.
              </Alert>
              <FormField id="reconciliation-reference" label="مرجع بازپرداخت خارجی" required>
                {(controlProps) => (
                  <Input
                    {...controlProps}
                    dir="ltr"
                    value={externalReference}
                    maxLength={255}
                    placeholder="کد پیگیری بازپرداخت درگاه"
                    disabled={pending}
                    onChange={(event) => setExternalReference(toPersianDigits(event.target.value))}
                  />
                )}
              </FormField>
              <FormField
                id="reconciliation-note"
                label="یادداشت بررسی"
                required
                error={error || undefined}
                hint="نتیجه تطبیق پنل درگاه و مستند تصمیم اپراتور را ثبت کنید."
              >
                {(controlProps) => (
                  <Textarea
                    {...controlProps}
                    value={note}
                    maxLength={1000}
                    placeholder="شرح بررسی، نتیجه تطبیق و دلیل رفع مغایرت"
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
