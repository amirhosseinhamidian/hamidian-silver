'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState, type FormEvent } from 'react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { DataTableColumn } from '@/components/ui/data-table';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Input, Textarea } from '@/components/ui/form-control';
import { FormField } from '@/components/ui/form-field';
import { MobileDataCard } from '@/components/ui/mobile-data-card';
import { ResponsiveDataView } from '@/components/ui/responsive-data-view';
import type {
  PaymentInitiationCandidate,
  PaymentOperationsSummary,
  PaymentReconciliation,
} from '@/lib/payments/payment-operations-model';
import {
  formatAdminDateTime,
  formatAdminInteger,
  formatAdminToman,
  toAsciiDigits,
  toPersianDigits,
} from '@/lib/presentation/formatters';

type PaymentOperationsViewProps = Readonly<{
  summary: PaymentOperationsSummary | null;
  initiations: readonly PaymentInitiationCandidate[];
  reconciliations: readonly PaymentReconciliation[];
  failed: boolean;
  canWrite: boolean;
}>;

type Queue = 'initiation' | 'reconciliation';
type RecoveryResolution = 'ABANDONED' | 'REDIRECTED';
type ActiveAction =
  | Readonly<{ kind: 'recovery'; row: PaymentInitiationCandidate; resolution: RecoveryResolution }>
  | Readonly<{ kind: 'reconciliation'; row: PaymentReconciliation }>;

const orderStatusLabels: Readonly<Record<string, string>> = {
  PENDING_PAYMENT: 'در انتظار پرداخت',
  PAID: 'پرداخت‌شده',
  PROCESSING: 'در حال پردازش',
  SHIPPED: 'ارسال‌شده',
  DELIVERED: 'تحویل‌شده',
  CANCELLED: 'لغوشده',
  EXPIRED: 'منقضی‌شده',
};

function orderStatusLabel(status: string): string {
  return orderStatusLabels[status] ?? toPersianDigits(status);
}

function isEscalated(createdAt: string): boolean {
  return Date.now() - new Date(createdAt).getTime() >= 30 * 60 * 1000;
}

function mutationErrorMessage(status: number): string {
  if (status === 401) return 'نشست مدیریتی منقضی شده است. دوباره وارد شوید.';
  if (status === 403) return 'مجوز انجام این عملیات را ندارید.';
  if (status === 404) return 'رکورد پرداخت پیدا نشد یا دیگر در دسترس نیست.';
  if (status === 409) return 'وضعیت پرداخت تغییر کرده است؛ صفحه را تازه‌سازی کنید.';
  if (status === 400 || status === 422)
    return 'اطلاعات عملیات معتبر نیست یا وضعیت پرداخت دیگر اجازه این تغییر را نمی‌دهد.';
  return 'عملیات پرداخت انجام نشد. دوباره تلاش کنید.';
}

function KpiCard({
  label,
  value,
  tone = 'neutral',
}: Readonly<{ label: string; value: number; tone?: 'neutral' | 'danger' | 'warning' }>) {
  const toneClass =
    tone === 'danger'
      ? 'text-[var(--admin-color-danger)]'
      : tone === 'warning'
        ? 'text-[var(--admin-color-warning)]'
        : 'text-[var(--admin-color-ink)]';
  return (
    <Card className="min-w-0">
      <p className="text-xs leading-5 text-[var(--admin-color-muted)]">{label}</p>
      <p className={`mt-2 text-2xl font-black ${toneClass}`}>{formatAdminInteger(value)}</p>
    </Card>
  );
}

function ProviderSummary({ summary }: Readonly<{ summary: PaymentOperationsSummary }>) {
  const providers = [
    ...new Set([
      ...Object.keys(summary.byProvider.stuckInitiations),
      ...Object.keys(summary.byProvider.openReconciliations),
    ]),
  ];
  if (!providers.length) return null;
  return (
    <div className="flex flex-wrap gap-2" aria-label="توزیع موارد بر اساس درگاه">
      {providers.map((provider) => (
        <Badge key={provider} tone="neutral">
          {toPersianDigits(provider)}: شروع نامشخص{' '}
          {formatAdminInteger(summary.byProvider.stuckInitiations[provider] ?? 0)} · مغایرت{' '}
          {formatAdminInteger(summary.byProvider.openReconciliations[provider] ?? 0)}
        </Badge>
      ))}
    </div>
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

function EscalationBadge({ createdAt }: Readonly<{ createdAt: string }>) {
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

export function PaymentOperationsView({
  summary,
  initiations,
  reconciliations,
  failed,
  canWrite,
}: PaymentOperationsViewProps) {
  const router = useRouter();
  const [queue, setQueue] = useState<Queue>('initiation');
  const [search, setSearch] = useState('');
  const [mobileDetailsId, setMobileDetailsId] = useState<string | null>(null);
  const [action, setAction] = useState<ActiveAction | null>(null);
  const [authority, setAuthority] = useState('');
  const [paymentUrl, setPaymentUrl] = useState('');
  const [externalReference, setExternalReference] = useState('');
  const [note, setNote] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const normalizedSearch = toAsciiDigits(search).trim().toLocaleLowerCase('fa');

  const filteredInitiations = useMemo(
    () =>
      initiations.filter((row) => {
        if (!normalizedSearch) return true;
        return [row.payment.order.orderNumber, row.provider, row.id].some((value) =>
          toAsciiDigits(value).toLocaleLowerCase('fa').includes(normalizedSearch),
        );
      }),
    [initiations, normalizedSearch],
  );
  const filteredReconciliations = useMemo(
    () =>
      reconciliations.filter((row) => {
        if (!normalizedSearch) return true;
        return [
          row.paymentAttempt.payment.order.orderNumber,
          row.provider,
          row.providerReference,
          row.reason,
        ].some((value) => toAsciiDigits(value).toLocaleLowerCase('fa').includes(normalizedSearch));
      }),
    [reconciliations, normalizedSearch],
  );

  function openAction(nextAction: ActiveAction) {
    setAction(nextAction);
    setAuthority('');
    setPaymentUrl('');
    setExternalReference('');
    setNote('');
    setError('');
    setSuccess('');
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
    let endpoint: string;
    let payload: Record<string, string>;
    if (action.kind === 'reconciliation') {
      const reference = toAsciiDigits(externalReference).trim();
      if (!reference) {
        setError('مرجع بازپرداخت خارجی الزامی است.');
        return;
      }
      endpoint = `/api/payments/reconciliations/${encodeURIComponent(action.row.id)}/resolve-external-refund`;
      payload = { externalRefundReference: reference, resolutionNote: normalizedNote };
    } else {
      endpoint = `/api/payments/initiation-recovery/${encodeURIComponent(action.row.id)}/resolve`;
      payload = { resolution: action.resolution, note: normalizedNote };
      if (action.resolution === 'REDIRECTED') {
        const normalizedAuthority = toAsciiDigits(authority).trim();
        const normalizedUrl = toAsciiDigits(paymentUrl).trim();
        if (!normalizedAuthority || !normalizedUrl) {
          setError('شناسه Authority و نشانی پرداخت برای بازیابی هدایت الزامی است.');
          return;
        }
        payload.authority = normalizedAuthority;
        payload.paymentUrl = normalizedUrl;
      }
    }
    setPending(true);
    setError('');
    try {
      const response = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        setError(mutationErrorMessage(response.status));
        return;
      }
      setSuccess(
        action.kind === 'reconciliation'
          ? 'مغایرت با مرجع بازپرداخت خارجی رفع شد.'
          : action.resolution === 'REDIRECTED'
            ? 'مسیر هدایت پرداخت با موفقیت بازیابی شد.'
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

  const initiationColumns: readonly DataTableColumn<PaymentInitiationCandidate>[] = [
    {
      id: 'order',
      header: 'سفارش',
      cell: (row) => (
        <span className="font-bold">{toPersianDigits(row.payment.order.orderNumber)}</span>
      ),
    },
    { id: 'provider', header: 'درگاه', cell: (row) => toPersianDigits(row.provider) },
    { id: 'amount', header: 'مبلغ', cell: (row) => formatAdminToman(row.amountToman) },
    {
      id: 'created',
      header: 'زمان ایجاد',
      cell: (row) => formatAdminDateTime(row.createdAt),
      visibility: 'lg',
    },
    {
      id: 'status',
      header: 'اولویت',
      cell: (row) => <EscalationBadge createdAt={row.createdAt} />,
    },
    {
      id: 'action',
      header: 'عملیات',
      align: 'end',
      cell: (row) =>
        canWrite ? (
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => openAction({ kind: 'recovery', row, resolution: 'REDIRECTED' })}
            >
              بازیابی هدایت
            </Button>
            <Button
              size="sm"
              variant="danger"
              onClick={() => openAction({ kind: 'recovery', row, resolution: 'ABANDONED' })}
            >
              مختومه
            </Button>
          </div>
        ) : (
          <span className="text-xs text-[var(--admin-color-muted)]">فقط مشاهده</span>
        ),
    },
  ];
  const reconciliationColumns: readonly DataTableColumn<PaymentReconciliation>[] = [
    {
      id: 'order',
      header: 'سفارش',
      cell: (row) => (
        <span className="font-bold">
          {toPersianDigits(row.paymentAttempt.payment.order.orderNumber)}
        </span>
      ),
    },
    {
      id: 'provider',
      header: 'درگاه / مرجع',
      cell: (row) => (
        <div>
          <p>{toPersianDigits(row.provider)}</p>
          <p className="text-xs text-[var(--admin-color-muted)]">
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
    {
      id: 'status',
      header: 'اولویت',
      cell: (row) => <EscalationBadge createdAt={row.createdAt} />,
    },
    {
      id: 'action',
      header: 'عملیات',
      align: 'end',
      cell: (row) =>
        canWrite ? (
          <Button size="sm" onClick={() => openAction({ kind: 'reconciliation', row })}>
            ثبت بازپرداخت خارجی
          </Button>
        ) : (
          <span className="text-xs text-[var(--admin-color-muted)]">فقط مشاهده</span>
        ),
    },
  ];

  const activeOrderNumber =
    action?.kind === 'reconciliation'
      ? action.row.paymentAttempt.payment.order.orderNumber
      : action?.row.payment.order.orderNumber;
  const formId = 'payment-operation-form';
  const dialogTitle =
    action?.kind === 'reconciliation'
      ? 'رفع مغایرت با بازپرداخت خارجی'
      : action?.resolution === 'REDIRECTED'
        ? 'بازیابی هدایت به درگاه'
        : 'مختومه‌کردن تلاش پرداخت';

  return (
    <div className="space-y-6">
      {failed ? (
        <Alert tone="danger" title="دریافت اطلاعات پرداخت ناموفق بود">
          ارتباط با سرویس پرداخت را بررسی و صفحه را تازه‌سازی کنید.
        </Alert>
      ) : null}
      {success ? <Alert tone="success">{success}</Alert> : null}
      {!canWrite ? (
        <Alert tone="info">
          دسترسی شما فقط برای مشاهده است؛ عملیات مالی به مجوز «finance.write» نیاز دارد.
        </Alert>
      ) : null}

      {summary ? (
        <section aria-label="شاخص‌های عملیات پرداخت" className="space-y-3">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard
              label="شروع پرداخت نامشخص"
              value={summary.stuckInitiations}
              tone={summary.stuckInitiations ? 'warning' : 'neutral'}
            />
            <KpiCard
              label="مغایرت باز"
              value={summary.openReconciliations}
              tone={summary.openReconciliations ? 'warning' : 'neutral'}
            />
            <KpiCard
              label="شروع بحرانی"
              value={summary.escalatedInitiations}
              tone={summary.escalatedInitiations ? 'danger' : 'neutral'}
            />
            <KpiCard
              label="مغایرت بحرانی"
              value={summary.escalatedReconciliations}
              tone={summary.escalatedReconciliations ? 'danger' : 'neutral'}
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <ProviderSummary summary={summary} />
            <p className="text-xs text-[var(--admin-color-subtle)]">
              به‌روزرسانی: {formatAdminDateTime(summary.generatedAt)}
            </p>
          </div>
        </section>
      ) : null}

      <Card>
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="صف‌های عملیات پرداخت">
            <Button
              role="tab"
              aria-selected={queue === 'initiation'}
              variant={queue === 'initiation' ? 'primary' : 'outline'}
              onClick={() => setQueue('initiation')}
            >
              شروع نامشخص ({formatAdminInteger(initiations.length)})
            </Button>
            <Button
              role="tab"
              aria-selected={queue === 'reconciliation'}
              variant={queue === 'reconciliation' ? 'primary' : 'outline'}
              onClick={() => setQueue('reconciliation')}
            >
              مغایرت باز ({formatAdminInteger(reconciliations.length)})
            </Button>
          </div>
          <label className="flex max-w-xl flex-col gap-1.5 text-xs font-semibold text-[var(--admin-color-muted)]">
            جستجو در صف فعال
            <Input
              value={search}
              placeholder="شماره سفارش، درگاه، مرجع یا علت مغایرت"
              onChange={(event) => setSearch(toPersianDigits(event.target.value))}
            />
          </label>
        </div>
      </Card>

      {queue === 'initiation' ? (
        <ResponsiveDataView
          caption="شروع پرداخت‌های نامشخص"
          mobileLabel="کارت‌های شروع پرداخت نامشخص"
          columns={initiationColumns}
          rows={filteredInitiations}
          getRowKey={(row) => row.id}
          emptyTitle={normalizedSearch ? 'نتیجه‌ای پیدا نشد' : 'شروع پرداخت نامشخصی وجود ندارد'}
          emptyDescription={
            normalizedSearch
              ? 'عبارت جستجو را تغییر دهید.'
              : 'هیچ تلاش ایجادشده قدیمی‌تر از آستانه بازیابی وجود ندارد.'
          }
          renderMobileCard={(row) => (
            <MobileDataCard
              detailsOpen={mobileDetailsId === row.id}
              onDetailsOpenChange={(open) => setMobileDetailsId(open ? row.id : null)}
              title={toPersianDigits(row.payment.order.orderNumber)}
              eyebrow={toPersianDigits(row.provider)}
              status={<EscalationBadge createdAt={row.createdAt} />}
              items={[
                { label: 'مبلغ', value: formatAdminToman(row.amountToman) },
                { label: 'وضعیت سفارش', value: orderStatusLabel(row.payment.order.status) },
                { label: 'ایجاد', value: formatAdminDateTime(row.createdAt) },
                {
                  label: 'انقضای رزرو',
                  value: formatAdminDateTime(row.payment.order.reservationExpiresAt),
                },
              ]}
              detailsTitle={`تلاش پرداخت ${toPersianDigits(row.payment.order.orderNumber)}`}
              details={
                <DetailRows
                  rows={[
                    ['شناسه تلاش', row.id],
                    ['درگاه', row.provider],
                    ['مبلغ تلاش', formatAdminToman(row.amountToman)],
                    ['مبلغ سفارش', formatAdminToman(row.payment.order.grandTotalToman)],
                    ['وضعیت سفارش', orderStatusLabel(row.payment.order.status)],
                    ['زمان ایجاد', formatAdminDateTime(row.createdAt)],
                    ['انقضای رزرو', formatAdminDateTime(row.payment.order.reservationExpiresAt)],
                  ]}
                />
              }
              detailsFooter={
                canWrite ? (
                  <div className="flex w-full gap-2">
                    <Button
                      className="flex-1"
                      variant="outline"
                      onClick={() => {
                        setMobileDetailsId(null);
                        openAction({ kind: 'recovery', row, resolution: 'REDIRECTED' });
                      }}
                    >
                      بازیابی هدایت
                    </Button>
                    <Button
                      className="flex-1"
                      variant="danger"
                      onClick={() => {
                        setMobileDetailsId(null);
                        openAction({ kind: 'recovery', row, resolution: 'ABANDONED' });
                      }}
                    >
                      مختومه
                    </Button>
                  </div>
                ) : undefined
              }
            />
          )}
        />
      ) : (
        <ResponsiveDataView
          caption="مغایرت‌های باز پرداخت"
          mobileLabel="کارت‌های مغایرت باز پرداخت"
          columns={reconciliationColumns}
          rows={filteredReconciliations}
          getRowKey={(row) => row.id}
          emptyTitle={normalizedSearch ? 'نتیجه‌ای پیدا نشد' : 'مغایرت بازی وجود ندارد'}
          emptyDescription={
            normalizedSearch
              ? 'عبارت جستجو را تغییر دهید.'
              : 'همه مغایرت‌های شناسایی‌شده تعیین تکلیف شده‌اند.'
          }
          renderMobileCard={(row) => (
            <MobileDataCard
              detailsOpen={mobileDetailsId === row.id}
              onDetailsOpenChange={(open) => setMobileDetailsId(open ? row.id : null)}
              title={toPersianDigits(row.paymentAttempt.payment.order.orderNumber)}
              eyebrow={toPersianDigits(row.provider)}
              status={<EscalationBadge createdAt={row.createdAt} />}
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
              details={
                <div className="space-y-4">
                  <Alert tone="warning" title="علت ثبت مغایرت">
                    {toPersianDigits(row.reason)}
                  </Alert>
                  <DetailRows
                    rows={[
                      ['شناسه تلاش', row.paymentAttempt.id],
                      ['درگاه', row.provider],
                      ['مرجع درگاه', row.providerReference],
                      ['مبلغ', formatAdminToman(row.amountToman)],
                      ['وضعیت پرداخت', row.paymentAttempt.payment.status],
                      ['وضعیت سفارش هنگام تشخیص', orderStatusLabel(row.detectedOrderStatus)],
                      ['زمان تشخیص', formatAdminDateTime(row.createdAt)],
                    ]}
                  />
                </div>
              }
              detailsFooter={
                canWrite ? (
                  <Button
                    className="w-full"
                    onClick={() => {
                      setMobileDetailsId(null);
                      openAction({ kind: 'reconciliation', row });
                    }}
                  >
                    ثبت بازپرداخت خارجی
                  </Button>
                ) : undefined
              }
            />
          )}
        />
      )}

      {!failed && !summary && !initiations.length && !reconciliations.length ? (
        <EmptyState title="داده‌ای برای عملیات پرداخت وجود ندارد" />
      ) : null}

      <Dialog
        open={action !== null}
        onOpenChange={(open) => {
          if (!open) closeAction();
        }}
      >
        <DialogContent
          title={dialogTitle}
          description={
            activeOrderNumber
              ? `سفارش ${toPersianDigits(activeOrderNumber)} را با اطلاعات پنل درگاه تطبیق دهید.`
              : undefined
          }
          hideClose={pending}
          footer={
            <>
              <Button variant="outline" disabled={pending} onClick={closeAction}>
                انصراف
              </Button>
              <Button
                type="submit"
                form={formId}
                variant={
                  action?.kind === 'recovery' && action.resolution === 'ABANDONED'
                    ? 'danger'
                    : 'primary'
                }
                loading={pending}
              >
                تأیید نهایی
              </Button>
            </>
          }
        >
          <form id={formId} onSubmit={submitAction} className="space-y-4">
            {action?.kind === 'recovery' && action.resolution === 'ABANDONED' ? (
              <Alert tone="danger" title="این عملیات برگشت‌پذیر نیست">
                فقط پس از اطمینان از ساخته‌نشدن تراکنش در پنل درگاه، تلاش را مختومه کنید.
              </Alert>
            ) : null}
            {action?.kind === 'recovery' && action.resolution === 'REDIRECTED' ? (
              <>
                <Alert tone="warning">
                  Authority و نشانی پرداخت را عیناً از پنل درگاه وارد کنید؛ سامانه دامنه و مسیر امن
                  درگاه را دوباره اعتبارسنجی می‌کند.
                </Alert>
                <FormField id="recovery-authority" label="شناسه Authority" required>
                  {(controlProps) => (
                    <Input
                      {...controlProps}
                      dir="ltr"
                      value={authority}
                      maxLength={255}
                      placeholder="Authority ثبت‌شده در درگاه"
                      onChange={(event) => setAuthority(toPersianDigits(event.target.value))}
                      disabled={pending}
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
                      onChange={(event) => setPaymentUrl(event.target.value)}
                      disabled={pending}
                    />
                  )}
                </FormField>
              </>
            ) : null}
            {action?.kind === 'reconciliation' ? (
              <>
                <Alert tone="danger" title="تأیید بازپرداخت خارج از سامانه">
                  این گزینه فقط زمانی مجاز است که وجه در پنل درگاه بازگردانده شده باشد.
                </Alert>
                <FormField id="external-refund-reference" label="مرجع بازپرداخت خارجی" required>
                  {(controlProps) => (
                    <Input
                      {...controlProps}
                      dir="ltr"
                      value={externalReference}
                      maxLength={255}
                      placeholder="کد پیگیری بازپرداخت درگاه"
                      onChange={(event) =>
                        setExternalReference(toPersianDigits(event.target.value))
                      }
                      disabled={pending}
                    />
                  )}
                </FormField>
              </>
            ) : null}
            <FormField
              id="payment-operation-note"
              label="یادداشت بررسی"
              required
              error={error || undefined}
              hint="نتیجه بررسی پنل درگاه و دلیل تصمیم را ثبت کنید."
            >
              {(controlProps) => (
                <Textarea
                  {...controlProps}
                  value={note}
                  maxLength={action?.kind === 'reconciliation' ? 1000 : 400}
                  placeholder="نتیجه بررسی و مستند تصمیم مالی"
                  onChange={(event) => setNote(toPersianDigits(event.target.value))}
                  disabled={pending}
                />
              )}
            </FormField>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
