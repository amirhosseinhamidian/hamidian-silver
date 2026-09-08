'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { Alert } from '@/components/ui/alert';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { BottomSheet, BottomSheetContent } from '@/components/ui/bottom-sheet';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { DataTableColumn } from '@/components/ui/data-table';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { DonutChart } from '@/components/ui/donut-chart';
import { FilterBar, SearchField } from '@/components/ui/filter-bar';
import { Textarea } from '@/components/ui/form-control';
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
import {
  parseOrderReturn,
  type AdminOrderReturn,
  type AdminOrderReturnActor,
  type AdminOrderReturnDisposition,
  type AdminOrderReturnStatus,
} from '@/lib/returns/returns-model';

type Props = Readonly<{
  returns: readonly AdminOrderReturn[];
  failed: boolean;
  canReject: boolean;
  canReceive: boolean;
}>;

type StatusFilter = AdminOrderReturnStatus | 'all';
type DispositionFilter = AdminOrderReturnDisposition | 'UNDECIDED' | 'all';
type DetailMode = 'desktop' | 'mobile' | null;
type ReturnAction = Readonly<{ kind: 'receive' | 'cancel'; orderReturn: AdminOrderReturn }>;

const STATUS: Record<AdminOrderReturnStatus, Readonly<{ label: string; tone: BadgeTone }>> = {
  REQUESTED: { label: 'در انتظار بررسی', tone: 'warning' },
  RECEIVED: { label: 'دریافت‌شده', tone: 'success' },
  CANCELLED: { label: 'رد یا لغوشده', tone: 'danger' },
};

const DISPOSITION: Record<AdminOrderReturnDisposition, string> = {
  RESTOCK: 'بازگشت به موجودی',
  RETURN_TO_SUPPLIER: 'بازگشت به تأمین‌کننده',
};

const STATUS_OPTIONS = [
  { value: 'all', label: 'همه وضعیت‌ها' },
  { value: 'REQUESTED', label: 'در انتظار بررسی' },
  { value: 'RECEIVED', label: 'دریافت‌شده' },
  { value: 'CANCELLED', label: 'رد یا لغوشده' },
];

const DISPOSITION_OPTIONS = [
  { value: 'all', label: 'همه مسیرهای تعیین تکلیف' },
  { value: 'UNDECIDED', label: 'تعیین‌تکلیف‌نشده' },
  { value: 'RESTOCK', label: 'بازگشت به موجودی' },
  { value: 'RETURN_TO_SUPPLIER', label: 'بازگشت به تأمین‌کننده' },
];

function actorLabel(actor: AdminOrderReturnActor | null): string {
  if (!actor) return 'ثبت نشده';
  const name = [actor.firstName, actor.lastName].filter(Boolean).join(' ');
  return name || formatAdminPhone(actor.phone);
}

function StatusBadge({ status }: Readonly<{ status: AdminOrderReturnStatus }>) {
  return (
    <Badge tone={STATUS[status].tone} dot>
      {STATUS[status].label}
    </Badge>
  );
}

function Kpi({
  label,
  value,
  description,
  tone,
}: Readonly<{ label: string; value: number; description: string; tone: BadgeTone }>) {
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

function ReturnItemDetails({ item }: Readonly<{ item: AdminOrderReturn['items'][number] }>) {
  const supplierReady =
    item.orderItem.supplierId &&
    item.orderItem.supplierName &&
    item.orderItem.unitSupplierPriceToman !== null;
  return (
    <article className="rounded-[var(--admin-radius-md)] border border-[var(--admin-color-border)] p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-bold">{item.orderItem.productName}</h4>
          <p className="mt-1 text-xs text-[var(--admin-color-muted)]">
            {item.orderItem.variantName ?? 'تنوع پایه'} · SKU{' '}
            <span dir="ltr">{toPersianDigits(item.orderItem.sku)}</span>
          </p>
        </div>
        <Badge tone={item.disposition ? 'success' : 'warning'}>
          {item.disposition ? DISPOSITION[item.disposition] : 'تعیین‌تکلیف‌نشده'}
        </Badge>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ['تعداد مرجوعی', item.quantity],
          ['تعداد فروخته‌شده', item.orderItem.soldQuantity],
          ['تخصیص مرجوعی', item.orderItem.allocatedQuantity],
          ['دریافت قطعی', item.orderItem.returnedQuantity],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-[var(--admin-radius-sm)] bg-[var(--admin-color-surface-subtle)] p-2"
          >
            <dt className="text-[0.6875rem] text-[var(--admin-color-subtle)]">{label}</dt>
            <dd className="mt-1 text-sm font-black">{formatAdminInteger(value as number)}</dd>
          </div>
        ))}
      </dl>
      {item.disposition === 'RETURN_TO_SUPPLIER' || item.supplierCredit ? (
        <div className="mt-3 border-t border-[var(--admin-color-border)] pt-3 text-xs leading-6 text-[var(--admin-color-muted)]">
          <p>تأمین‌کننده: {item.orderItem.supplierName ?? 'ثبت نشده'}</p>
          {item.supplierCredit ? (
            <p>
              اعتبار ایجادشده: {formatAdminToman(item.supplierCredit.amountToman)} ·{' '}
              {toPersianDigits(item.supplierCredit.status)}
            </p>
          ) : !supplierReady ? (
            <p className="text-[var(--admin-color-danger)]">
              اطلاعات تأمین‌کننده برای ایجاد اعتبار کامل نیست.
            </p>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function ReturnDetails({ orderReturn }: Readonly<{ orderReturn: AdminOrderReturn }>) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 lg:grid-cols-2">
        <Card title="درخواست مرجوعی">
          <DetailRows
            rows={[
              ['شماره سفارش', orderReturn.orderNumber],
              ['وضعیت سفارش', orderReturn.orderStatus],
              ['وضعیت مرجوعی', STATUS[orderReturn.status].label],
              ['زمان درخواست', formatAdminDateTime(orderReturn.createdAt)],
              ['درخواست‌کننده', actorLabel(orderReturn.requestedBy)],
              ['دلیل درخواست', orderReturn.reason ?? 'ثبت نشده'],
            ]}
          />
        </Card>
        <Card title="نتیجه بررسی و دریافت">
          <DetailRows
            rows={[
              ['دریافت توسط', actorLabel(orderReturn.receivedBy)],
              [
                'زمان دریافت',
                orderReturn.receivedAt ? formatAdminDateTime(orderReturn.receivedAt) : 'ثبت نشده',
              ],
              ['یادداشت دریافت', orderReturn.receiveNote ?? 'ثبت نشده'],
              ['رد یا لغو توسط', actorLabel(orderReturn.cancelledBy)],
              [
                'زمان رد یا لغو',
                orderReturn.cancelledAt ? formatAdminDateTime(orderReturn.cancelledAt) : 'ثبت نشده',
              ],
              ['دلیل رد یا لغو', orderReturn.cancelReason ?? 'ثبت نشده'],
            ]}
          />
        </Card>
      </div>
      <Card
        title={`اقلام مرجوعی · ${formatAdminInteger(orderReturn.items.length)} قلم`}
        description="تخصیص هر قلم در کنار تعداد فروخته‌شده و دریافت قطعی نمایش داده می‌شود."
      >
        <div className="grid gap-3">
          {orderReturn.items.map((item) => (
            <ReturnItemDetails key={item.id} item={item} />
          ))}
        </div>
      </Card>
    </div>
  );
}

type ReturnActionsProps = Readonly<{
  orderReturn: AdminOrderReturn;
  canReject: boolean;
  canReceive: boolean;
  onAction: (kind: ReturnAction['kind'], orderReturn: AdminOrderReturn) => void;
}>;

function ReturnActions({ orderReturn, canReject, canReceive, onAction }: ReturnActionsProps) {
  if (orderReturn.status !== 'REQUESTED') {
    return (
      <ButtonLink href="/orders" variant="outline" size="sm">
        صفحه سفارش‌ها
      </ButtonLink>
    );
  }
  return (
    <div className="flex flex-wrap justify-end gap-2">
      <ButtonLink href="/orders" variant="outline" size="sm">
        صفحه سفارش‌ها
      </ButtonLink>
      {canReject ? (
        <Button size="sm" variant="danger" onClick={() => onAction('cancel', orderReturn)}>
          رد درخواست
        </Button>
      ) : null}
      {canReceive ? (
        <Button size="sm" onClick={() => onAction('receive', orderReturn)}>
          تأیید و ثبت دریافت
        </Button>
      ) : null}
    </div>
  );
}

function requestError(status: number): string {
  if (status === 401) return 'نشست مدیریتی منقضی شده است. دوباره وارد شوید.';
  if (status === 403) return 'مجوز انجام این عملیات را ندارید.';
  if (status === 404) return 'درخواست مرجوعی پیدا نشد.';
  if (status === 409) return 'وضعیت مرجوعی یا تخصیص آن تغییر کرده است؛ صفحه را تازه کنید.';
  if (status === 400 || status === 422) return 'اطلاعات تعیین تکلیف اقلام معتبر نیست.';
  return 'عملیات مرجوعی انجام نشد. دوباره تلاش کنید.';
}

export function ReturnManagementView({ returns, failed, canReject, canReceive }: Props) {
  const router = useRouter();
  const [items, setItems] = useState<readonly AdminOrderReturn[]>(returns);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('REQUESTED');
  const [dispositionFilter, setDispositionFilter] = useState<DispositionFilter>('all');
  const [selected, setSelected] = useState<AdminOrderReturn | null>(null);
  const [detailMode, setDetailMode] = useState<DetailMode>(null);
  const [action, setAction] = useState<ReturnAction | null>(null);
  const [dispositions, setDispositions] = useState<
    Record<string, AdminOrderReturnDisposition | ''>
  >({});
  const [note, setNote] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [pending, setPending] = useState(false);
  const needle = toAsciiDigits(search).trim().toLocaleLowerCase('fa');

  const counts = useMemo(
    () => ({
      requested: items.filter((item) => item.status === 'REQUESTED').length,
      received: items.filter((item) => item.status === 'RECEIVED').length,
      cancelled: items.filter((item) => item.status === 'CANCELLED').length,
      allocated: items
        .filter((item) => item.status === 'REQUESTED')
        .flatMap((item) => item.items)
        .reduce((sum, item) => sum + item.quantity, 0),
    }),
    [items],
  );

  const filtered = useMemo(
    () =>
      items.filter((orderReturn) => {
        if (statusFilter !== 'all' && orderReturn.status !== statusFilter) return false;
        if (
          dispositionFilter !== 'all' &&
          !orderReturn.items.some((item) =>
            dispositionFilter === 'UNDECIDED'
              ? item.disposition === null
              : item.disposition === dispositionFilter,
          )
        ) {
          return false;
        }
        if (!needle) return true;
        return [
          orderReturn.orderNumber,
          actorLabel(orderReturn.requestedBy),
          orderReturn.reason ?? '',
          ...orderReturn.items.flatMap((item) => [
            item.orderItem.productName,
            item.orderItem.variantName ?? '',
            item.orderItem.sku,
          ]),
        ].some((value) => toAsciiDigits(value).toLocaleLowerCase('fa').includes(needle));
      }),
    [dispositionFilter, items, needle, statusFilter],
  );

  function openDetails(orderReturn: AdminOrderReturn, mode: Exclude<DetailMode, null>) {
    setSelected(orderReturn);
    setDetailMode(mode);
  }

  function closeDetails() {
    setSelected(null);
    setDetailMode(null);
  }

  function openAction(kind: ReturnAction['kind'], orderReturn: AdminOrderReturn) {
    closeDetails();
    setAction({ kind, orderReturn });
    setDispositions(Object.fromEntries(orderReturn.items.map((item) => [item.id, ''])));
    setNote('');
    setReason('');
    setError('');
    setSuccess('');
  }

  async function submitAction() {
    if (!action || pending) return;
    let body: object;
    if (action.kind === 'cancel') {
      const normalizedReason = reason.trim();
      if (normalizedReason.length < 3) {
        setError('دلیل رد درخواست باید حداقل ۳ کاراکتر باشد.');
        return;
      }
      body = { reason: normalizedReason };
    } else {
      const missing = action.orderReturn.items.some((item) => !dispositions[item.id]);
      if (missing) {
        setError('برای همه اقلام، مسیر تعیین تکلیف را انتخاب کنید.');
        return;
      }
      const normalizedNote = note.trim();
      if (normalizedNote && normalizedNote.length < 3) {
        setError('یادداشت دریافت باید حداقل ۳ کاراکتر باشد.');
        return;
      }
      body = {
        items: action.orderReturn.items.map((item) => ({
          returnItemId: item.id,
          disposition: dispositions[item.id],
        })),
        ...(normalizedNote ? { note: normalizedNote } : {}),
      };
    }
    setPending(true);
    setError('');
    try {
      const response = await fetch(
        `/api/order-returns/${encodeURIComponent(action.orderReturn.id)}/${action.kind}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      );
      if (!response.ok) {
        setError(requestError(response.status));
        return;
      }
      const updated = parseOrderReturn(await response.json());
      if (!updated) {
        setError('پاسخ به‌روزشده مرجوعی معتبر نیست.');
        return;
      }
      setItems((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setAction(null);
      setSuccess(
        action.kind === 'receive'
          ? 'دریافت و تعیین تکلیف اقلام با موفقیت ثبت شد.'
          : 'درخواست مرجوعی رد و تخصیص آن آزاد شد.',
      );
      router.refresh();
    } catch {
      setError('ارتباط با سرور برقرار نشد. دوباره تلاش کنید.');
    } finally {
      setPending(false);
    }
  }

  const detailFooter = selected ? (
    <ReturnActions
      orderReturn={selected}
      canReject={canReject}
      canReceive={canReceive}
      onAction={openAction}
    />
  ) : undefined;

  const columns: readonly DataTableColumn<AdminOrderReturn>[] = [
    {
      id: 'return',
      header: 'مرجوعی',
      cell: (orderReturn) => (
        <div>
          <p className="font-bold" dir="ltr">
            {toPersianDigits(orderReturn.orderNumber)}
          </p>
          <p className="mt-1 text-xs text-[var(--admin-color-muted)]">
            {formatAdminInteger(orderReturn.items.length)} قلم ·{' '}
            {formatAdminInteger(orderReturn.items.reduce((sum, item) => sum + item.quantity, 0))}{' '}
            عدد
          </p>
        </div>
      ),
    },
    {
      id: 'status',
      header: 'وضعیت',
      cell: (orderReturn) => <StatusBadge status={orderReturn.status} />,
    },
    {
      id: 'requester',
      header: 'درخواست‌کننده',
      visibility: 'lg',
      cell: (orderReturn) => actorLabel(orderReturn.requestedBy),
    },
    {
      id: 'created',
      header: 'زمان درخواست',
      visibility: 'lg',
      cell: (orderReturn) => formatAdminDateTime(orderReturn.createdAt),
    },
    {
      id: 'allocation',
      header: 'تخصیص',
      cell: (orderReturn) =>
        formatAdminInteger(orderReturn.items.reduce((sum, item) => sum + item.quantity, 0)),
    },
    {
      id: 'actions',
      header: 'عملیات',
      align: 'end',
      cell: (orderReturn) => (
        <Button size="sm" variant="outline" onClick={() => openDetails(orderReturn, 'desktop')}>
          جزئیات و بررسی
        </Button>
      ),
    },
  ];

  const activeFilterCount =
    Number(Boolean(needle)) +
    Number(statusFilter !== 'REQUESTED') +
    Number(dispositionFilter !== 'all');

  return (
    <div className="space-y-6">
      {failed ? (
        <Alert tone="danger" title="فهرست مرجوعی دریافت نشد">
          اتصال API را بررسی و صفحه را تازه‌سازی کنید.
        </Alert>
      ) : null}
      {success ? <Alert tone="success">{success}</Alert> : null}
      {!canReject ? (
        <Alert tone="info">دسترسی شما برای مدیریت مرجوعی فقط‌خواندنی است.</Alert>
      ) : null}
      {canReject && !canReceive ? (
        <Alert tone="warning">
          برای ثبت دریافت، دسترسی هم‌زمان عملیات سفارش و ویرایش موجودی لازم است؛ امکان رد درخواست
          همچنان فعال است.
        </Alert>
      ) : null}

      <section aria-label="شاخص‌های مرجوعی" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          label="در انتظار"
          value={counts.requested}
          description="نیازمند بررسی"
          tone={counts.requested ? 'warning' : 'success'}
        />
        <Kpi
          label="تخصیص فعال"
          value={counts.allocated}
          description="تعداد کالای رزروشده"
          tone={counts.allocated ? 'info' : 'neutral'}
        />
        <Kpi
          label="دریافت‌شده"
          value={counts.received}
          description="تعیین تکلیف قطعی"
          tone="success"
        />
        <Kpi
          label="رد یا لغوشده"
          value={counts.cancelled}
          description="تخصیص آزادشده"
          tone="danger"
        />
      </section>

      <Card
        title="ترکیب وضعیت مرجوعی‌ها"
        description="نمای سریع حجم درخواست‌های باز و تعیین‌تکلیف‌شده"
      >
        <DonutChart
          title="ترکیب وضعیت مرجوعی‌ها"
          centerLabel="درخواست"
          segments={[
            { label: 'در انتظار', value: counts.requested, color: 'var(--admin-color-warning)' },
            { label: 'دریافت‌شده', value: counts.received, color: 'var(--admin-color-success)' },
            { label: 'رد یا لغوشده', value: counts.cancelled, color: 'var(--admin-color-danger)' },
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
                setStatusFilter('REQUESTED');
                setDispositionFilter('all');
              }}
            >
              بازنشانی فیلترها
            </Button>
          ) : undefined
        }
      >
        <SearchField
          aria-label="جستجوی مرجوعی"
          value={search}
          placeholder="شماره سفارش، مشتری، محصول یا SKU"
          onChange={(event) => setSearch(toPersianDigits(event.target.value))}
        />
        <Select
          aria-label="فیلتر وضعیت مرجوعی"
          value={statusFilter}
          options={STATUS_OPTIONS}
          onValueChange={(value) => setStatusFilter(value as StatusFilter)}
        />
        <Select
          aria-label="فیلتر مسیر تعیین تکلیف"
          value={dispositionFilter}
          options={DISPOSITION_OPTIONS}
          onValueChange={(value) => setDispositionFilter(value as DispositionFilter)}
        />
      </FilterBar>

      <ResponsiveDataView
        caption="درخواست‌های مرجوعی"
        mobileLabel="کارت‌های مرجوعی"
        columns={columns}
        rows={filtered}
        getRowKey={(orderReturn) => orderReturn.id}
        emptyTitle={activeFilterCount ? 'نتیجه‌ای پیدا نشد' : 'درخواست بازی وجود ندارد'}
        emptyDescription="درخواست‌های جدید مشتری یا مدیر در این صف نمایش داده می‌شوند."
        renderMobileCard={(orderReturn) => (
          <MobileDataCard
            detailsOpen={detailMode === 'mobile' && selected?.id === orderReturn.id}
            onDetailsOpenChange={(open) =>
              open ? openDetails(orderReturn, 'mobile') : closeDetails()
            }
            title={`سفارش ${toPersianDigits(orderReturn.orderNumber)}`}
            eyebrow={`${formatAdminInteger(orderReturn.items.length)} قلم مرجوعی`}
            status={<StatusBadge status={orderReturn.status} />}
            items={[
              {
                label: 'تعداد',
                value: formatAdminInteger(
                  orderReturn.items.reduce((sum, item) => sum + item.quantity, 0),
                ),
              },
              { label: 'درخواست‌کننده', value: actorLabel(orderReturn.requestedBy) },
              { label: 'زمان درخواست', value: formatAdminDateTime(orderReturn.createdAt) },
              { label: 'وضعیت سفارش', value: orderReturn.orderStatus },
            ]}
            detailsTitle={`مرجوعی سفارش ${toPersianDigits(orderReturn.orderNumber)}`}
            detailsDescription={STATUS[orderReturn.status].label}
            details={<ReturnDetails orderReturn={orderReturn} />}
            detailsFooter={detailFooter}
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
          title={
            selected ? `مرجوعی سفارش ${toPersianDigits(selected.orderNumber)}` : 'جزئیات مرجوعی'
          }
          description={selected ? STATUS[selected.status].label : undefined}
          footer={detailFooter}
        >
          {selected ? <ReturnDetails orderReturn={selected} /> : null}
        </DialogContent>
      </Dialog>

      <BottomSheet
        open={action !== null}
        onOpenChange={(open) => {
          if (!open && !pending) setAction(null);
        }}
      >
        <BottomSheetContent
          height="large"
          hideClose={pending}
          title={action?.kind === 'receive' ? 'تأیید و ثبت دریافت' : 'رد درخواست مرجوعی'}
          description={
            action ? `سفارش ${toPersianDigits(action.orderReturn.orderNumber)}` : undefined
          }
          footer={
            <>
              <Button variant="outline" disabled={pending} onClick={() => setAction(null)}>
                انصراف
              </Button>
              <Button
                variant={action?.kind === 'cancel' ? 'danger' : 'primary'}
                loading={pending}
                onClick={submitAction}
              >
                {action?.kind === 'receive' ? 'ثبت دریافت' : 'تأیید رد درخواست'}
              </Button>
            </>
          }
        >
          {action?.kind === 'receive' ? (
            <div className="space-y-4">
              <Alert tone="warning">
                ثبت دریافت قطعی است. اقلام بازگشتی به موجودی اضافه می‌شوند و برای اقلام تأمین‌کننده،
                اعتبار مرحله ۲۸ ساخته می‌شود.
              </Alert>
              {action.orderReturn.items.map((item) => {
                const supplierReady = Boolean(
                  item.orderItem.supplierId &&
                  item.orderItem.supplierName &&
                  item.orderItem.unitSupplierPriceToman !== null,
                );
                return (
                  <FormField
                    key={item.id}
                    id={`disposition-${item.id}`}
                    label={`${item.orderItem.productName} · ${formatAdminInteger(item.quantity)} عدد`}
                    required
                    hint={
                      supplierReady
                        ? `تأمین‌کننده: ${item.orderItem.supplierName}`
                        : 'اطلاعات تأمین‌کننده کامل نیست؛ فقط بازگشت به موجودی مجاز است.'
                    }
                  >
                    {(controlProps) => (
                      <Select
                        {...controlProps}
                        value={dispositions[item.id] ?? ''}
                        placeholder="مسیر تعیین تکلیف را انتخاب کنید"
                        options={[
                          { value: 'RESTOCK', label: 'بازگشت به موجودی' },
                          {
                            value: 'RETURN_TO_SUPPLIER',
                            label: 'بازگشت به تأمین‌کننده',
                            disabled: !supplierReady,
                          },
                        ]}
                        disabled={pending}
                        onValueChange={(value) =>
                          setDispositions((current) => ({
                            ...current,
                            [item.id]: value as AdminOrderReturnDisposition,
                          }))
                        }
                      />
                    )}
                  </FormField>
                );
              })}
              <FormField
                id="return-receive-note"
                label="یادداشت دریافت"
                hint="اختیاری؛ وضعیت ظاهری یا توضیحات کنترل کالا را ثبت کنید."
              >
                {(controlProps) => (
                  <Textarea
                    {...controlProps}
                    value={note}
                    maxLength={1000}
                    disabled={pending}
                    placeholder="مثلاً بسته سالم و اقلام مطابق درخواست دریافت شدند."
                    onChange={(event) => setNote(event.target.value)}
                  />
                )}
              </FormField>
            </div>
          ) : action ? (
            <div className="space-y-4">
              <Alert tone="danger">
                با رد درخواست، تخصیص همه اقلام به‌صورت اتمیک آزاد می‌شود. این عملیات فقط تا پیش از
                دریافت قابل انجام است.
              </Alert>
              <FormField
                id="return-cancel-reason"
                label="دلیل رد درخواست"
                required
                error={error || undefined}
              >
                {(controlProps) => (
                  <Textarea
                    {...controlProps}
                    value={reason}
                    maxLength={1000}
                    disabled={pending}
                    placeholder="دلیل تصمیم را برای سابقه عملیات ثبت کنید."
                    onChange={(event) => {
                      setReason(event.target.value);
                      if (error) setError('');
                    }}
                  />
                )}
              </FormField>
            </div>
          ) : null}
          {action?.kind === 'receive' && error ? (
            <Alert tone="danger" className="mt-4">
              {error}
            </Alert>
          ) : null}
        </BottomSheetContent>
      </BottomSheet>
    </div>
  );
}
