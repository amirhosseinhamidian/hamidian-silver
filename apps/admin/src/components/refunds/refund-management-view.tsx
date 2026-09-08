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
import {
  formatAdminDateTime,
  formatAdminInteger,
  formatAdminPhone,
  formatAdminToman,
  toAsciiDigits,
  toPersianDigits,
} from '@/lib/presentation/formatters';
import type {
  AdminPaymentRefund,
  AdminRefundActor,
  AdminRefundOrder,
  AdminRefundStatus,
} from '@/lib/refunds/refunds-model';

type Props = Readonly<{
  refunds: readonly AdminPaymentRefund[];
  orders: readonly AdminRefundOrder[];
  failed: boolean;
  canWrite: boolean;
}>;

type StatusFilter = 'all' | AdminRefundStatus;
type ActiveAction =
  | Readonly<{ kind: 'create'; idempotencyKey: string }>
  | Readonly<{ kind: 'confirm'; refund: AdminPaymentRefund }>
  | Readonly<{ kind: 'cancel'; refund: AdminPaymentRefund }>;

const STATUS_PRESENTATION: Readonly<
  Record<AdminRefundStatus, { label: string; tone: 'warning' | 'success' | 'neutral' | 'danger' }>
> = {
  PENDING: { label: 'در انتظار اقدام', tone: 'warning' },
  CONFIRMED: { label: 'تأییدشده', tone: 'success' },
  CANCELLED: { label: 'لغوشده', tone: 'neutral' },
  FAILED: { label: 'ناموفق', tone: 'danger' },
};

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
  PAID: 'پرداخت‌شده',
  PARTIALLY_REFUNDED: 'بخشی بازپرداخت‌شده',
  REFUNDED: 'کاملاً بازپرداخت‌شده',
};

function providerLabel(provider: string | null) {
  if (!provider) return 'ثبت نشده';
  const labels: Readonly<Record<string, string>> = {
    zarinpal: 'زرین‌پال',
    zibal: 'زیبال',
    mellat: 'بانک ملت',
  };
  return labels[provider.toLocaleLowerCase('en')] ?? toPersianDigits(provider);
}

function actorLabel(actor: AdminRefundActor | null) {
  if (!actor) return 'ثبت نشده';
  return (
    [actor.firstName, actor.lastName].filter(Boolean).join(' ') || formatAdminPhone(actor.phone)
  );
}

function paymentStatusLabel(status: string) {
  return PAYMENT_STATUS_LABELS[status] ?? toPersianDigits(status);
}

function orderStatusLabel(status: string) {
  return ORDER_STATUS_LABELS[status] ?? toPersianDigits(status);
}

function StatusBadge({ status }: Readonly<{ status: AdminRefundStatus }>) {
  const presentation = STATUS_PRESENTATION[status];
  return <Badge tone={presentation.tone}>{presentation.label}</Badge>;
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

function RefundDetails({ refund }: Readonly<{ refund: AdminPaymentRefund }>) {
  return (
    <div className="space-y-4">
      <DetailRows
        rows={[
          ['شناسه بازپرداخت', refund.id],
          ['شماره سفارش', refund.payment.order.orderNumber],
          ['وضعیت سفارش', orderStatusLabel(refund.payment.order.status)],
          ['وضعیت پرداخت', paymentStatusLabel(refund.payment.status)],
          ['مبلغ پرداخت', formatAdminToman(refund.payment.amountToman)],
          ['بازپرداخت قطعی', formatAdminToman(refund.payment.refundedAmountToman)],
          ['ظرفیت تخصیص‌یافته', formatAdminToman(refund.payment.refundAllocatedToman)],
          ['مبلغ این درخواست', formatAdminToman(refund.amountToman)],
          ['درگاه', providerLabel(refund.providerSnapshot)],
          ['مرجع پرداخت اصلی', refund.originalProviderReferenceSnapshot ?? 'ثبت نشده'],
          ['زمان درخواست', formatAdminDateTime(refund.createdAt)],
          ['درخواست‌کننده', actorLabel(refund.requestedBy)],
          ['یادداشت درخواست', refund.requestNote ?? 'ثبت نشده'],
        ]}
      />
      {refund.status !== 'PENDING' ? (
        <Card title="نتیجه عملیات">
          <DetailRows
            rows={[
              ['وضعیت', STATUS_PRESENTATION[refund.status].label],
              ['مرجع بازپرداخت', refund.externalReference ?? 'ثبت نشده'],
              [
                'اپراتور',
                actorLabel(refund.status === 'CONFIRMED' ? refund.confirmedBy : refund.cancelledBy),
              ],
              [
                'زمان نتیجه',
                refund.confirmedAt
                  ? formatAdminDateTime(refund.confirmedAt)
                  : refund.cancelledAt
                    ? formatAdminDateTime(refund.cancelledAt)
                    : 'ثبت نشده',
              ],
              ['یادداشت نتیجه', refund.resolutionNote ?? 'ثبت نشده'],
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
  tone?: 'neutral' | 'warning' | 'success' | 'danger';
}>) {
  const toneClass = {
    neutral: 'text-[var(--admin-color-ink)]',
    warning: 'text-[var(--admin-color-warning)]',
    success: 'text-[var(--admin-color-success)]',
    danger: 'text-[var(--admin-color-danger)]',
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

function normalizeMoneyInput(value: string) {
  return toPersianDigits(toAsciiDigits(value).replace(/\D/g, ''));
}

function errorMessage(status: number) {
  if (status === 401) return 'نشست مدیریتی منقضی شده است. دوباره وارد شوید.';
  if (status === 403) return 'مجوز انجام عملیات مالی را ندارید.';
  if (status === 404) return 'پرداخت یا بازپرداخت پیدا نشد.';
  if (status === 409)
    return 'وضعیت یا ظرفیت بازپرداخت هم‌زمان تغییر کرده است؛ صفحه را تازه‌سازی و دوباره بررسی کنید.';
  if (status === 400 || status === 422)
    return 'اطلاعات واردشده معتبر نیست یا پرداخت در وضعیت قابل بازپرداخت قرار ندارد.';
  return 'عملیات بازپرداخت انجام نشد. دوباره تلاش کنید.';
}

function newIdempotencyKey() {
  return `admin-refund-${crypto.randomUUID()}`;
}

export function RefundManagementView({ refunds, orders, failed, canWrite }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [provider, setProvider] = useState('all');
  const [mobileDetailsId, setMobileDetailsId] = useState<string | null>(null);
  const [desktopDetails, setDesktopDetails] = useState<AdminPaymentRefund | null>(null);
  const [action, setAction] = useState<ActiveAction | null>(null);
  const [orderId, setOrderId] = useState('');
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const eligibleOrders = useMemo(
    () =>
      orders.filter(
        (order) =>
          (order.payment.status === 'PAID' || order.payment.status === 'PARTIALLY_REFUNDED') &&
          order.payment.refundedAmountToman < order.payment.amountToman,
      ),
    [orders],
  );
  const providers = useMemo(
    () => [
      ...new Set(
        refunds
          .map((refund) => refund.providerSnapshot)
          .filter((value): value is string => Boolean(value)),
      ),
    ],
    [refunds],
  );
  const selectedOrder = eligibleOrders.find((order) => order.id === orderId) ?? null;
  const selectedRemaining = selectedOrder
    ? Math.max(0, selectedOrder.payment.amountToman - selectedOrder.payment.refundAllocatedToman)
    : 0;

  const needle = toAsciiDigits(search).trim().toLocaleLowerCase('fa');
  const filtered = useMemo(
    () =>
      refunds.filter((refund) => {
        if (status !== 'all' && refund.status !== status) return false;
        if (provider !== 'all' && refund.providerSnapshot !== provider) return false;
        if (!needle) return true;
        return [
          refund.id,
          refund.payment.order.orderNumber,
          refund.providerSnapshot,
          refund.originalProviderReferenceSnapshot,
          refund.externalReference,
          refund.requestNote,
          refund.resolutionNote,
          actorLabel(refund.requestedBy),
          actorLabel(refund.confirmedBy),
          actorLabel(refund.cancelledBy),
        ].some((value) =>
          value ? toAsciiDigits(value).toLocaleLowerCase('fa').includes(needle) : false,
        );
      }),
    [needle, provider, refunds, status],
  );

  const counts = {
    pending: refunds.filter((refund) => refund.status === 'PENDING').length,
    confirmed: refunds.filter((refund) => refund.status === 'CONFIRMED').length,
    cancelled: refunds.filter((refund) => refund.status === 'CANCELLED').length,
    failed: refunds.filter((refund) => refund.status === 'FAILED').length,
  };
  const confirmedAmount = refunds
    .filter((refund) => refund.status === 'CONFIRMED')
    .reduce((sum, refund) => sum + refund.amountToman, 0);
  const activeFilterCount =
    Number(Boolean(search.trim())) + Number(status !== 'all') + Number(provider !== 'all');

  function resetFields() {
    setOrderId('');
    setAmount('');
    setReference('');
    setNote('');
    setError('');
  }

  function openAction(nextAction: ActiveAction) {
    setDesktopDetails(null);
    setMobileDetailsId(null);
    resetFields();
    setAction(nextAction);
  }

  function closeAction() {
    if (pending) return;
    setAction(null);
    setError('');
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!action || pending) return;
    const normalizedNote = note.trim();
    if (normalizedNote.length < 3) {
      setError('یادداشت عملیات باید حداقل ۳ نویسه باشد.');
      return;
    }

    let endpoint: string;
    let body: Record<string, string | number>;
    if (action.kind === 'create') {
      const normalizedAmount = Number(toAsciiDigits(amount));
      if (!selectedOrder || !Number.isSafeInteger(normalizedAmount) || normalizedAmount < 1) {
        setError('سفارش و مبلغ معتبر بازپرداخت را وارد کنید.');
        return;
      }
      if (normalizedAmount > selectedRemaining) {
        setError('مبلغ از ظرفیت باقیمانده بازپرداخت بیشتر است.');
        return;
      }
      endpoint = '/api/refunds';
      body = {
        orderId: selectedOrder.id,
        amountToman: normalizedAmount,
        idempotencyKey: action.idempotencyKey,
        note: normalizedNote,
      };
    } else if (action.kind === 'confirm') {
      const normalizedReference = toAsciiDigits(reference).trim();
      if (!normalizedReference) {
        setError('مرجع بازپرداخت درگاه الزامی است.');
        return;
      }
      endpoint = `/api/refunds/${encodeURIComponent(action.refund.id)}/confirm`;
      body = { externalReference: normalizedReference, note: normalizedNote };
    } else {
      endpoint = `/api/refunds/${encodeURIComponent(action.refund.id)}/cancel`;
      body = { reason: normalizedNote };
    }

    setPending(true);
    setError('');
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        setError(errorMessage(response.status));
        return;
      }
      setSuccess(
        action.kind === 'create'
          ? 'درخواست بازپرداخت ثبت و مبلغ آن رزرو شد.'
          : action.kind === 'confirm'
            ? 'بازپرداخت با مرجع درگاه تأیید شد.'
            : 'درخواست بازپرداخت لغو و ظرفیت آن آزاد شد.',
      );
      setAction(null);
      router.refresh();
    } catch {
      setError('ارتباط با سرور برقرار نشد. دوباره تلاش کنید.');
    } finally {
      setPending(false);
    }
  }

  const columns: readonly DataTableColumn<AdminPaymentRefund>[] = [
    {
      id: 'order',
      header: 'سفارش',
      cell: (refund) => (
        <div>
          <p className="font-bold">{toPersianDigits(refund.payment.order.orderNumber)}</p>
          <p className="mt-1 text-xs text-[var(--admin-color-muted)]">
            {formatAdminDateTime(refund.createdAt)}
          </p>
        </div>
      ),
    },
    {
      id: 'provider',
      header: 'درگاه / مرجع',
      cell: (refund) => (
        <div>
          <p>{providerLabel(refund.providerSnapshot)}</p>
          <p className="mt-1 max-w-44 truncate text-xs text-[var(--admin-color-muted)]">
            {toPersianDigits(
              refund.externalReference ?? refund.originalProviderReferenceSnapshot ?? 'بدون مرجع',
            )}
          </p>
        </div>
      ),
    },
    { id: 'amount', header: 'مبلغ', cell: (refund) => formatAdminToman(refund.amountToman) },
    {
      id: 'operator',
      header: 'اپراتور',
      cell: (refund) => actorLabel(refund.requestedBy),
      visibility: 'lg',
    },
    {
      id: 'status',
      header: 'وضعیت',
      cell: (refund) => <StatusBadge status={refund.status} />,
    },
    {
      id: 'actions',
      header: 'عملیات',
      align: 'end',
      cell: (refund) => (
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={() => setDesktopDetails(refund)}>
            جزئیات
          </Button>
          {refund.status === 'PENDING' && canWrite ? (
            <Button size="sm" onClick={() => openAction({ kind: 'confirm', refund })}>
              تأیید نتیجه
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  if (failed) {
    return (
      <Alert tone="danger" title="دریافت اطلاعات بازپرداخت ناموفق بود" className="mt-6">
        ارتباط با سرویس مالی را بررسی و صفحه را تازه‌سازی کنید.
      </Alert>
    );
  }

  const dialogTitle =
    action?.kind === 'create'
      ? 'ثبت درخواست بازپرداخت'
      : action?.kind === 'confirm'
        ? 'تأیید بازپرداخت انجام‌شده'
        : 'لغو درخواست بازپرداخت';

  return (
    <div className="space-y-6 pt-6">
      {success ? <Alert tone="success">{success}</Alert> : null}
      {!canWrite ? (
        <Alert tone="info">
          دسترسی شما فقط برای مشاهده است؛ عملیات بازپرداخت به مجوز «finance.write» نیاز دارد.
        </Alert>
      ) : null}
      <Alert tone="warning" title="بازپرداخت مالی، مجوز مرجوعی کالا نیست">
        این بخش دکمه مرجوعی مشتری را فعال نمی‌کند. مرجوعی فقط برای سفارش مجازشده توسط مدیر و طبق
        شرایط استثنایی فروشگاه انجام می‌شود.
      </Alert>

      <section aria-label="شاخص‌های بازپرداخت" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="کل درخواست‌ها" value={refunds.length} />
        <KpiCard
          label="در انتظار اقدام"
          value={counts.pending}
          tone={counts.pending ? 'warning' : 'neutral'}
        />
        <KpiCard label="تأییدشده" value={counts.confirmed} tone="success" />
        <KpiCard label="مبلغ قطعی" value={formatAdminToman(confirmedAmount)} tone="success" />
      </section>

      <Card title="توزیع وضعیت بازپرداخت‌ها" description="درخواست‌های مالی براساس آخرین وضعیت">
        <DonutChart
          title="توزیع وضعیت بازپرداخت‌ها"
          segments={[
            {
              label: 'در انتظار اقدام',
              value: counts.pending,
              color: 'var(--admin-color-warning)',
            },
            { label: 'تأییدشده', value: counts.confirmed, color: 'var(--admin-color-success)' },
            { label: 'لغوشده', value: counts.cancelled, color: 'var(--admin-color-muted)' },
            { label: 'ناموفق', value: counts.failed, color: 'var(--admin-color-danger)' },
          ]}
        />
      </Card>

      <FilterBar
        activeCount={activeFilterCount}
        actions={
          canWrite ? (
            <Button
              onClick={() => openAction({ kind: 'create', idempotencyKey: newIdempotencyKey() })}
            >
              درخواست بازپرداخت
            </Button>
          ) : undefined
        }
        resetAction={
          activeFilterCount ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setSearch('');
                setStatus('all');
                setProvider('all');
              }}
            >
              پاک‌کردن فیلترها
            </Button>
          ) : undefined
        }
      >
        <SearchField
          aria-label="جستجوی بازپرداخت"
          placeholder="سفارش، مرجع، درگاه، یادداشت یا اپراتور"
          value={search}
          onChange={(event) => setSearch(toPersianDigits(event.target.value))}
        />
        <Select
          aria-label="فیلتر وضعیت بازپرداخت"
          value={status}
          onValueChange={(value) => setStatus(value as StatusFilter)}
          options={[
            { value: 'all', label: 'همه وضعیت‌ها' },
            ...Object.entries(STATUS_PRESENTATION).map(([value, item]) => ({
              value,
              label: item.label,
            })),
          ]}
        />
        <Select
          aria-label="فیلتر درگاه بازپرداخت"
          value={provider}
          onValueChange={setProvider}
          options={[
            { value: 'all', label: 'همه درگاه‌ها' },
            ...providers.map((value) => ({ value, label: providerLabel(value) })),
          ]}
        />
      </FilterBar>

      <ResponsiveDataView
        caption="فهرست بازپرداخت‌ها"
        mobileLabel="کارت‌های بازپرداخت"
        columns={columns}
        rows={filtered}
        getRowKey={(refund) => refund.id}
        emptyTitle={activeFilterCount ? 'نتیجه‌ای پیدا نشد' : 'بازپرداختی ثبت نشده است'}
        emptyDescription={
          activeFilterCount
            ? 'عبارت جستجو یا فیلترها را تغییر دهید.'
            : 'درخواست‌های مالی بازپرداخت پس از ثبت در این صف نمایش داده می‌شوند.'
        }
        renderMobileCard={(refund) => (
          <MobileDataCard
            detailsOpen={mobileDetailsId === refund.id}
            onDetailsOpenChange={(open) => setMobileDetailsId(open ? refund.id : null)}
            title={toPersianDigits(refund.payment.order.orderNumber)}
            eyebrow={providerLabel(refund.providerSnapshot)}
            status={<StatusBadge status={refund.status} />}
            items={[
              { label: 'مبلغ', value: formatAdminToman(refund.amountToman) },
              { label: 'درخواست‌کننده', value: actorLabel(refund.requestedBy) },
              {
                label: 'مرجع',
                value: toPersianDigits(refund.externalReference ?? 'ثبت نشده'),
              },
              { label: 'زمان درخواست', value: formatAdminDateTime(refund.createdAt) },
            ]}
            detailsTitle={`بازپرداخت سفارش ${toPersianDigits(refund.payment.order.orderNumber)}`}
            details={<RefundDetails refund={refund} />}
            detailsFooter={
              refund.status === 'PENDING' && canWrite ? (
                <div className="flex w-full gap-2">
                  <Button
                    className="flex-1"
                    onClick={() => openAction({ kind: 'confirm', refund })}
                  >
                    تأیید نتیجه
                  </Button>
                  <Button
                    className="flex-1"
                    variant="danger"
                    onClick={() => openAction({ kind: 'cancel', refund })}
                  >
                    لغو درخواست
                  </Button>
                </div>
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
            title={`بازپرداخت سفارش ${toPersianDigits(desktopDetails.payment.order.orderNumber)}`}
            description="جزئیات مالی و سابقه اپراتورها"
            footer={
              desktopDetails.status === 'PENDING' && canWrite ? (
                <>
                  <Button
                    variant="danger"
                    onClick={() => openAction({ kind: 'cancel', refund: desktopDetails })}
                  >
                    لغو درخواست
                  </Button>
                  <Button onClick={() => openAction({ kind: 'confirm', refund: desktopDetails })}>
                    تأیید نتیجه
                  </Button>
                </>
              ) : undefined
            }
          >
            <RefundDetails refund={desktopDetails} />
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
            title={dialogTitle}
            description={
              action.kind === 'create'
                ? 'ثبت درخواست، ظرفیت مبلغ را تا تعیین نتیجه رزرو می‌کند.'
                : `سفارش ${toPersianDigits(action.refund.payment.order.orderNumber)}`
            }
            hideClose={pending}
            footer={
              <>
                <Button variant="outline" disabled={pending} onClick={closeAction}>
                  انصراف
                </Button>
                <Button
                  type="submit"
                  form="refund-operation-form"
                  variant={action.kind === 'cancel' ? 'danger' : 'primary'}
                  loading={pending}
                >
                  تأیید نهایی
                </Button>
              </>
            }
          >
            <form id="refund-operation-form" className="space-y-4" onSubmit={submit}>
              {action.kind === 'create' ? (
                <>
                  <Alert tone="warning">
                    ثبت درخواست پولی جابه‌جا نمی‌کند؛ مبلغ تا ثبت نتیجه قطعی برای جلوگیری از
                    بازپرداخت هم‌زمان رزرو می‌شود.
                  </Alert>
                  <FormField id="refund-order" label="سفارش" required>
                    {(controlProps) => (
                      <Select
                        {...controlProps}
                        value={orderId}
                        onValueChange={(value) => {
                          setOrderId(value);
                          setAmount('');
                        }}
                        placeholder="سفارش پرداخت‌شده را انتخاب کنید"
                        options={eligibleOrders.map((order) => ({
                          value: order.id,
                          label: `${toPersianDigits(order.orderNumber)} — ${formatAdminToman(
                            order.payment.amountToman,
                          )}`,
                        }))}
                        disabled={pending}
                      />
                    )}
                  </FormField>
                  {selectedOrder ? (
                    <Card>
                      <DetailRows
                        rows={[
                          ['مبلغ پرداخت', formatAdminToman(selectedOrder.payment.amountToman)],
                          [
                            'بازپرداخت قطعی',
                            formatAdminToman(selectedOrder.payment.refundedAmountToman),
                          ],
                          ['ظرفیت در دسترس', formatAdminToman(selectedRemaining)],
                        ]}
                      />
                    </Card>
                  ) : null}
                  <FormField id="refund-amount" label="مبلغ بازپرداخت (تومان)" required>
                    {(controlProps) => (
                      <Input
                        {...controlProps}
                        inputMode="numeric"
                        value={amount}
                        placeholder="مثلاً ۱٬۵۰۰٬۰۰۰"
                        disabled={pending || !selectedOrder}
                        onChange={(event) => setAmount(normalizeMoneyInput(event.target.value))}
                      />
                    )}
                  </FormField>
                </>
              ) : null}

              {action.kind === 'confirm' ? (
                <>
                  <Alert tone="danger" title="فقط پس از انجام بازپرداخت در درگاه تأیید کنید">
                    سامانه از این فرم وجهی جابه‌جا نمی‌کند. مرجع را عیناً از پنل درگاه ثبت کنید.
                  </Alert>
                  <DetailRows
                    rows={[
                      ['درگاه', providerLabel(action.refund.providerSnapshot)],
                      ['مبلغ', formatAdminToman(action.refund.amountToman)],
                      [
                        'مرجع پرداخت اصلی',
                        action.refund.originalProviderReferenceSnapshot ?? 'ثبت نشده',
                      ],
                    ]}
                  />
                  <FormField id="refund-reference" label="مرجع بازپرداخت درگاه" required>
                    {(controlProps) => (
                      <Input
                        {...controlProps}
                        dir="ltr"
                        value={reference}
                        maxLength={255}
                        placeholder="کد پیگیری بازپرداخت"
                        disabled={pending}
                        onChange={(event) => setReference(toPersianDigits(event.target.value))}
                      />
                    )}
                  </FormField>
                </>
              ) : null}

              {action.kind === 'cancel' ? (
                <Alert tone="danger" title="لغو فقط برای درخواست در انتظار مجاز است">
                  با لغو، ظرفیت رزروشده بازپرداخت آزاد می‌شود و بازگردانی وجه ثبت نخواهد شد.
                </Alert>
              ) : null}

              <FormField
                id="refund-note"
                label={action.kind === 'cancel' ? 'دلیل لغو' : 'یادداشت عملیات'}
                required
                error={error || undefined}
                hint="دلیل تصمیم و شواهد بررسی را برای سابقه مالی ثبت کنید."
              >
                {(controlProps) => (
                  <Textarea
                    {...controlProps}
                    value={note}
                    maxLength={1000}
                    placeholder={
                      action.kind === 'cancel'
                        ? 'دلیل لغو درخواست بازپرداخت'
                        : 'شرح علت بازپرداخت و نتیجه بررسی'
                    }
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
