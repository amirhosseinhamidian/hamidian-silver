'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState, type FormEvent } from 'react';

import { Alert } from '@/components/ui/alert';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { DataTableColumn } from '@/components/ui/data-table';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { FilterBar, SearchField } from '@/components/ui/filter-bar';
import { Input, Textarea } from '@/components/ui/form-control';
import { FormField } from '@/components/ui/form-field';
import { MobileDataCard } from '@/components/ui/mobile-data-card';
import { ResponsiveDataView } from '@/components/ui/responsive-data-view';
import { Select } from '@/components/ui/select';
import type { AdminOrder, AdminShipmentStatus } from '@/lib/orders/orders-model';
import {
  formatAdminDateTime,
  formatAdminInteger,
  formatAdminPhone,
  formatAdminToman,
  toAsciiDigits,
  toPersianDigits,
} from '@/lib/presentation/formatters';

type Props = Readonly<{
  orders: readonly AdminOrder[];
  failed: boolean;
  canCreate: boolean;
  canUpdateStatus: boolean;
}>;

type ShippingFilter = 'all' | 'uncreated' | AdminShipmentStatus;
type ShippingAction =
  | Readonly<{ kind: 'create'; order: AdminOrder }>
  | Readonly<{ kind: 'status'; order: AdminOrder; status: AdminShipmentStatus }>;

const STATUS: Record<AdminShipmentStatus, { label: string; tone: BadgeTone }> = {
  PENDING: { label: 'در انتظار آماده‌سازی', tone: 'warning' },
  READY: { label: 'آماده تحویل به پست', tone: 'info' },
  HANDED_OVER: { label: 'تحویل به پست', tone: 'info' },
  IN_TRANSIT: { label: 'در مسیر', tone: 'warning' },
  DELIVERED: { label: 'تحویل‌شده', tone: 'success' },
  FAILED: { label: 'ارسال ناموفق', tone: 'danger' },
  CANCELLED: { label: 'لغوشده', tone: 'neutral' },
};

const FILTERS = [
  { value: 'all', label: 'همه وضعیت‌ها' },
  { value: 'uncreated', label: 'بدون مرسوله' },
  ...Object.entries(STATUS).map(([value, item]) => ({ value, label: item.label })),
];
const decimalFormatter = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 3 });

function shippingOrder(order: AdminOrder) {
  return (
    Boolean(order.shipment) || ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'].includes(order.status)
  );
}

function eligibleForCreation(order: AdminOrder) {
  return (
    !order.shipment &&
    ['PAID', 'PROCESSING'].includes(order.status) &&
    order.payment?.status === 'PAID'
  );
}

function nextStatus(status: AdminShipmentStatus): AdminShipmentStatus | null {
  if (status === 'PENDING') return 'READY';
  if (status === 'READY') return 'HANDED_OVER';
  if (status === 'HANDED_OVER') return 'IN_TRANSIT';
  if (status === 'IN_TRANSIT') return 'DELIVERED';
  return null;
}

function StatusBadge({ order }: Readonly<{ order: AdminOrder }>) {
  if (!order.shipment)
    return (
      <Badge tone="warning" dot>
        بدون مرسوله
      </Badge>
    );
  const item = STATUS[order.shipment.status];
  return (
    <Badge tone={item.tone} dot>
      {item.label}
    </Badge>
  );
}

function Kpi({
  label,
  value,
  tone = 'neutral',
}: Readonly<{ label: string; value: number; tone?: BadgeTone }>) {
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

function ShipmentDetails({ order }: Readonly<{ order: AdminOrder }>) {
  const shipment = order.shipment;
  return (
    <div className="space-y-4">
      <Card title="گیرنده و نشانی">
        <DetailRows
          rows={[
            ['نام گیرنده', order.address?.recipientName ?? 'ثبت نشده'],
            ['شماره تماس', order.address ? formatAdminPhone(order.address.phone) : 'ثبت نشده'],
            [
              'استان و شهر',
              order.address ? `${order.address.province}، ${order.address.city}` : 'ثبت نشده',
            ],
            ['کد پستی', order.address?.postalCode ?? 'ثبت نشده'],
            ['نشانی', order.address?.addressLine ?? 'ثبت نشده'],
          ]}
        />
      </Card>
      <Card title="مشخصات مرسوله">
        {shipment ? (
          <DetailRows
            rows={[
              ['سرویس', shipment.serviceName ?? shipment.serviceCode],
              [
                'هزینه ثبت‌شده',
                shipment.shippingCostToman === 0
                  ? 'رایگان'
                  : formatAdminToman(shipment.shippingCostToman),
              ],
              ['وزن', `${decimalFormatter.format(shipment.totalWeightGrams)} گرم`],
              [
                'زمان تقریبی',
                shipment.estimatedDeliveryDays
                  ? `${formatAdminInteger(shipment.estimatedDeliveryDays)} روز`
                  : 'ثبت نشده',
              ],
              ['کد رهگیری', shipment.trackingCode ?? 'هنوز ثبت نشده'],
              [
                'زمان ارسال',
                shipment.shippedAt ? formatAdminDateTime(shipment.shippedAt) : 'ثبت نشده',
              ],
              [
                'زمان تحویل',
                shipment.deliveredAt ? formatAdminDateTime(shipment.deliveredAt) : 'ثبت نشده',
              ],
            ]}
          />
        ) : (
          <Alert tone="warning">برای این سفارش هنوز مرسوله ساخته نشده است.</Alert>
        )}
      </Card>
      <Card title="Timeline ارسال">
        {shipment?.timeline.length ? (
          <ol className="relative before:absolute before:inset-y-3 before:start-[0.3125rem] before:w-px before:bg-[var(--admin-color-border)]">
            {shipment.timeline.map((entry) => (
              <li key={entry.id} className="relative pb-4 ps-6 last:pb-0">
                <span
                  aria-hidden="true"
                  className="absolute start-0 top-1.5 size-2.5 rounded-full border-2 border-white bg-[var(--admin-color-primary)] ring-1 ring-[var(--admin-color-border)]"
                />
                <div className="flex flex-wrap justify-between gap-2">
                  <p className="text-sm font-bold">{STATUS[entry.toStatus].label}</p>
                  <time className="text-xs text-[var(--admin-color-subtle)]">
                    {formatAdminDateTime(entry.createdAt)}
                  </time>
                </div>
                <p className="mt-1 text-xs text-[var(--admin-color-muted)]">
                  {toPersianDigits(entry.actor)}
                </p>
                {entry.reason ? (
                  <p className="mt-1 text-xs leading-6">{toPersianDigits(entry.reason)}</p>
                ) : null}
              </li>
            ))}
          </ol>
        ) : (
          <Alert tone="neutral">رویدادی برای این مرسوله ثبت نشده است.</Alert>
        )}
      </Card>
    </div>
  );
}

function mutationError(status: number) {
  if (status === 401) return 'نشست مدیریتی منقضی شده است. دوباره وارد شوید.';
  if (status === 403) return 'مجوز انجام این عملیات را ندارید.';
  if (status === 404) return 'سفارش یا مرسوله پیدا نشد.';
  if (status === 409) return 'وضعیت مرسوله تغییر کرده است؛ صفحه را تازه‌سازی کنید.';
  if (status === 400 || status === 422)
    return 'اطلاعات معتبر نیست یا سفارش هنوز برای این مرحله آماده نشده است.';
  return 'عملیات ارسال انجام نشد. دوباره تلاش کنید.';
}

export function ShippingManagementView({ orders, failed, canCreate, canUpdateStatus }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<ShippingFilter>('all');
  const [detailsOrder, setDetailsOrder] = useState<AdminOrder | null>(null);
  const [mobileDetailsId, setMobileDetailsId] = useState<string | null>(null);
  const [action, setAction] = useState<ShippingAction | null>(null);
  const [serviceName, setServiceName] = useState('ارسال استاندارد');
  const [estimatedDays, setEstimatedDays] = useState('۳');
  const [trackingCode, setTrackingCode] = useState('');
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const candidates = useMemo(() => orders.filter(shippingOrder), [orders]);
  const needle = toAsciiDigits(search).trim().toLocaleLowerCase('fa');
  const filtered = useMemo(
    () =>
      candidates.filter((order) => {
        if (filter === 'uncreated' && order.shipment) return false;
        if (filter !== 'all' && filter !== 'uncreated' && order.shipment?.status !== filter)
          return false;
        if (!needle) return true;
        return [
          order.orderNumber,
          order.customer.name ?? '',
          order.customer.phone,
          order.shipment?.trackingCode ?? '',
        ].some((value) => toAsciiDigits(value).toLocaleLowerCase('fa').includes(needle));
      }),
    [candidates, filter, needle],
  );
  const counts = {
    uncreated: candidates.filter(eligibleForCreation).length,
    ready: candidates.filter((order) => ['PENDING', 'READY'].includes(order.shipment?.status ?? ''))
      .length,
    transit: candidates.filter((order) =>
      ['HANDED_OVER', 'IN_TRANSIT'].includes(order.shipment?.status ?? ''),
    ).length,
    delivered: candidates.filter((order) => order.shipment?.status === 'DELIVERED').length,
    failed: candidates.filter((order) => order.shipment?.status === 'FAILED').length,
  };

  function openAction(nextAction: ShippingAction) {
    setMobileDetailsId(null);
    setAction(nextAction);
    setServiceName('ارسال استاندارد');
    setEstimatedDays('۳');
    setTrackingCode(nextAction.order.shipment?.trackingCode ?? '');
    setReason('');
    setError('');
    setSuccess('');
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!action || pending) return;
    const cleanReason = reason.trim();
    if (cleanReason.length < 3) return setError('دلیل عملیات باید حداقل ۳ نویسه باشد.');
    let endpoint: string;
    let method: 'POST' | 'PATCH';
    let payload: Record<string, string | number>;
    if (action.kind === 'create') {
      const days = Number(toAsciiDigits(estimatedDays));
      if (serviceName.trim().length < 2 || !Number.isInteger(days) || days < 1 || days > 30)
        return setError('نام سرویس و زمان تحویل بین ۱ تا ۳۰ روز را درست وارد کنید.');
      endpoint = `/api/shipping/orders/${encodeURIComponent(action.order.id)}/manual`;
      method = 'POST';
      payload = {
        serviceName: serviceName.trim(),
        estimatedDeliveryDays: days,
        reason: cleanReason,
      };
    } else {
      const tracking = toAsciiDigits(trackingCode).trim();
      if (action.status === 'HANDED_OVER' && !tracking)
        return setError('ثبت کد رهگیری پیش از تحویل مرسوله به پست الزامی است.');
      endpoint = `/api/shipping/orders/${encodeURIComponent(action.order.id)}/status`;
      method = 'PATCH';
      payload = {
        status: action.status,
        reason: cleanReason,
        ...(tracking ? { trackingCode: tracking } : {}),
      };
    }
    setPending(true);
    setError('');
    try {
      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) return setError(mutationError(response.status));
      setAction(null);
      setSuccess(
        action.kind === 'create'
          ? 'مرسوله دستی ساخته و آماده ارسال شد.'
          : `وضعیت مرسوله به «${STATUS[action.status].label}» تغییر کرد.`,
      );
      router.refresh();
    } catch {
      setError('ارتباط با سرور برقرار نشد. دوباره تلاش کنید.');
    } finally {
      setPending(false);
    }
  }

  function Actions({ order }: Readonly<{ order: AdminOrder }>) {
    if (canCreate && eligibleForCreation(order))
      return (
        <Button size="sm" onClick={() => openAction({ kind: 'create', order })}>
          ساخت مرسوله دستی
        </Button>
      );
    const next = order.shipment ? nextStatus(order.shipment.status) : null;
    if (!canUpdateStatus || !next)
      return <span className="text-xs text-[var(--admin-color-muted)]">فقط مشاهده</span>;
    return (
      <div className="flex flex-wrap justify-end gap-2">
        <Button size="sm" onClick={() => openAction({ kind: 'status', order, status: next })}>
          {STATUS[next].label}
        </Button>
        <Button
          size="sm"
          variant="danger"
          onClick={() => openAction({ kind: 'status', order, status: 'FAILED' })}
        >
          ثبت مشکل ارسال
        </Button>
      </div>
    );
  }

  const columns: readonly DataTableColumn<AdminOrder>[] = [
    {
      id: 'order',
      header: 'سفارش',
      cell: (order) => (
        <div>
          <p className="font-bold">{toPersianDigits(order.orderNumber)}</p>
          <p className="mt-1 text-xs text-[var(--admin-color-muted)]">
            {toPersianDigits(order.customer.name ?? formatAdminPhone(order.customer.phone))}
          </p>
        </div>
      ),
    },
    { id: 'status', header: 'وضعیت ارسال', cell: (order) => <StatusBadge order={order} /> },
    {
      id: 'service',
      header: 'سرویس',
      cell: (order) => order.shipment?.serviceName ?? '—',
      visibility: 'lg',
    },
    {
      id: 'tracking',
      header: 'کد رهگیری',
      cell: (order) => toPersianDigits(order.shipment?.trackingCode ?? 'ثبت نشده'),
    },
    {
      id: 'updated',
      header: 'آخرین تغییر',
      cell: (order) => formatAdminDateTime(order.shipment?.updatedAt ?? order.updatedAt),
      visibility: 'lg',
    },
    {
      id: 'actions',
      header: 'عملیات',
      align: 'end',
      cell: (order) => (
        <div className="flex flex-wrap justify-end gap-2">
          <Button size="sm" variant="outline" onClick={() => setDetailsOrder(order)}>
            جزئیات
          </Button>
          <Actions order={order} />
        </div>
      ),
    },
  ];
  const activeOrder = action?.order;
  const actionTitle =
    action?.kind === 'create' ? 'ساخت مرسوله دستی' : action ? STATUS[action.status].label : '';

  return (
    <div className="space-y-6">
      {failed ? (
        <Alert tone="danger" title="دریافت سفارش‌ها ناموفق بود">
          ارتباط با API را بررسی و صفحه را تازه‌سازی کنید.
        </Alert>
      ) : null}
      {success ? <Alert tone="success">{success}</Alert> : null}
      {!canCreate && !canUpdateStatus ? (
        <Alert tone="info">دسترسی شما فقط برای مشاهده اطلاعات ارسال است.</Alert>
      ) : null}
      <section aria-label="شاخص‌های مدیریت ارسال" className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi
          label="نیازمند ساخت مرسوله"
          value={counts.uncreated}
          tone={counts.uncreated ? 'warning' : 'neutral'}
        />
        <Kpi label="آماده ارسال" value={counts.ready} />
        <Kpi label="در مسیر" value={counts.transit} tone="warning" />
        <Kpi label="تحویل‌شده" value={counts.delivered} tone="success" />
        <Kpi
          label="ارسال ناموفق"
          value={counts.failed}
          tone={counts.failed ? 'danger' : 'neutral'}
        />
      </section>
      <Alert tone="info" title="ارسال دستی بدون Postex">
        هزینه آنلاین استعلام نمی‌شود؛ مبلغ ارسال ثبت‌شده سفارش حفظ می‌شود و کد رهگیری هنگام تحویل
        مرسوله به پست وارد خواهد شد.
      </Alert>
      <FilterBar
        activeCount={Number(Boolean(needle)) + Number(filter !== 'all')}
        resetAction={
          needle || filter !== 'all' ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setSearch('');
                setFilter('all');
              }}
            >
              پاک‌کردن فیلترها
            </Button>
          ) : undefined
        }
      >
        <SearchField
          aria-label="جستجوی ارسال"
          value={search}
          placeholder="شماره سفارش، مشتری، موبایل یا کد رهگیری"
          onChange={(event) => setSearch(toPersianDigits(event.target.value))}
        />
        <Select
          aria-label="فیلتر وضعیت ارسال"
          value={filter}
          options={FILTERS}
          onValueChange={(value) => setFilter(value as ShippingFilter)}
        />
      </FilterBar>
      <ResponsiveDataView
        caption="سفارش‌ها و وضعیت ارسال"
        mobileLabel="کارت‌های مدیریت ارسال"
        columns={columns}
        rows={filtered}
        getRowKey={(order) => order.id}
        emptyTitle={
          needle || filter !== 'all' ? 'نتیجه‌ای پیدا نشد' : 'سفارشی برای ارسال وجود ندارد'
        }
        renderMobileCard={(order) => (
          <MobileDataCard
            detailsOpen={mobileDetailsId === order.id}
            onDetailsOpenChange={(open) => setMobileDetailsId(open ? order.id : null)}
            title={toPersianDigits(order.orderNumber)}
            eyebrow={toPersianDigits(order.customer.name ?? formatAdminPhone(order.customer.phone))}
            status={<StatusBadge order={order} />}
            items={[
              { label: 'سرویس', value: order.shipment?.serviceName ?? 'ثبت نشده' },
              {
                label: 'هزینه',
                value:
                  order.shippingTotalToman === 0
                    ? 'رایگان'
                    : formatAdminToman(order.shippingTotalToman),
              },
              {
                label: 'کد رهگیری',
                value: toPersianDigits(order.shipment?.trackingCode ?? 'ثبت نشده'),
              },
              {
                label: 'آخرین تغییر',
                value: formatAdminDateTime(order.shipment?.updatedAt ?? order.updatedAt),
              },
            ]}
            detailsTitle={`ارسال سفارش ${toPersianDigits(order.orderNumber)}`}
            details={<ShipmentDetails order={order} />}
            detailsFooter={canCreate || canUpdateStatus ? <Actions order={order} /> : undefined}
          />
        )}
      />
      <Dialog
        open={detailsOrder !== null}
        onOpenChange={(open) => {
          if (!open) setDetailsOrder(null);
        }}
      >
        <DialogContent
          size="lg"
          title={
            detailsOrder
              ? `ارسال سفارش ${toPersianDigits(detailsOrder.orderNumber)}`
              : 'جزئیات ارسال'
          }
          description="مشخصات گیرنده، مرسوله و timeline کامل عملیات ارسال"
        >
          {detailsOrder ? <ShipmentDetails order={detailsOrder} /> : null}
        </DialogContent>
      </Dialog>
      <Dialog
        open={action !== null}
        onOpenChange={(open) => {
          if (!open && !pending) setAction(null);
        }}
      >
        <DialogContent
          title={actionTitle}
          description={
            activeOrder
              ? `سفارش ${toPersianDigits(activeOrder.orderNumber)} را پیش از تأیید بررسی کنید.`
              : undefined
          }
          hideClose={pending}
          footer={
            <>
              <Button variant="outline" disabled={pending} onClick={() => setAction(null)}>
                انصراف
              </Button>
              <Button
                type="submit"
                form="shipping-operation-form"
                variant={
                  action?.kind === 'status' && action.status === 'FAILED' ? 'danger' : 'primary'
                }
                loading={pending}
              >
                تأیید نهایی
              </Button>
            </>
          }
        >
          <form id="shipping-operation-form" onSubmit={submit} className="space-y-4">
            {action?.kind === 'create' ? (
              <>
                <Alert tone="info">
                  مرسوله داخل سامانه ساخته می‌شود و هیچ درخواستی به Postex ارسال نخواهد شد.
                </Alert>
                <FormField id="manual-service-name" label="نام سرویس ارسال" required>
                  {(props) => (
                    <Input
                      {...props}
                      value={serviceName}
                      maxLength={200}
                      placeholder="مثلاً پست پیشتاز"
                      onChange={(event) => setServiceName(toPersianDigits(event.target.value))}
                      disabled={pending}
                    />
                  )}
                </FormField>
                <FormField
                  id="manual-estimated-days"
                  label="زمان تقریبی تحویل"
                  required
                  hint="بین ۱ تا ۳۰ روز"
                >
                  {(props) => (
                    <Input
                      {...props}
                      inputMode="numeric"
                      value={estimatedDays}
                      placeholder="مثلاً ۳"
                      onChange={(event) => setEstimatedDays(toPersianDigits(event.target.value))}
                      disabled={pending}
                    />
                  )}
                </FormField>
              </>
            ) : null}
            {action?.kind === 'status' && action.status === 'HANDED_OVER' ? (
              <FormField
                id="manual-tracking-code"
                label="کد رهگیری"
                required
                hint="پس از ثبت، این کد در حساب مشتری نمایش داده می‌شود."
              >
                {(props) => (
                  <Input
                    {...props}
                    dir="ltr"
                    value={trackingCode}
                    maxLength={255}
                    placeholder="کد رهگیری صادرشده توسط پست"
                    onChange={(event) => setTrackingCode(toPersianDigits(event.target.value))}
                    disabled={pending}
                  />
                )}
              </FormField>
            ) : null}
            {action?.kind === 'status' && action.status === 'FAILED' ? (
              <Alert tone="danger" title="وضعیت نهایی و حساس">
                پس از ثبت ارسال ناموفق، وضعیت مرسوله از همین مسیر قابل بازگشت نیست.
              </Alert>
            ) : null}
            <FormField
              id="shipping-operation-reason"
              label="یادداشت عملیات"
              required
              error={error || undefined}
              hint="در timeline ارسال با نام اپراتور ثبت می‌شود."
            >
              {(props) => (
                <Textarea
                  {...props}
                  value={reason}
                  maxLength={500}
                  placeholder="شرح اقدام یا نتیجه تحویل مرسوله"
                  onChange={(event) => setReason(toPersianDigits(event.target.value))}
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
