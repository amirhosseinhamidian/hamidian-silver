'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState, type FormEvent } from 'react';

import { Alert } from '@/components/ui/alert';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import type { DataTableColumn } from '@/components/ui/data-table';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input, Textarea } from '@/components/ui/form-control';
import { FormField } from '@/components/ui/form-field';
import { MoneyInput } from '@/components/ui/money-input';
import { ResponsiveDataView } from '@/components/ui/responsive-data-view';
import { SearchField } from '@/components/ui/filter-bar';
import { Select } from '@/components/ui/select';
import type { AdminOrder, AdminShipmentStatus } from '@/lib/orders/orders-model';
import type { AdminPlatingOrder } from '@/lib/plating-operations/plating-operations-model';
import {
  formatAdminDateTime,
  formatAdminInteger,
  formatAdminToman,
  toAsciiDigits,
  toPersianDigits,
} from '@/lib/presentation/formatters';
import type { AdminShippingCarrier } from '@/lib/shipping/shipping-pricing-model';

type Props = Readonly<{
  orders: readonly AdminOrder[];
  platingOrders: readonly AdminPlatingOrder[];
  carriers: readonly AdminShippingCarrier[];
  failed: boolean;
  canUpdateStatus: boolean;
  canCreateShipment: boolean;
  canCompletePlating: boolean;
}>;

type CompletionAction =
  | 'ORDER_PROCESSING'
  | 'PLATING_START'
  | 'PLATING_COMPLETE'
  | 'SHIPMENT_CREATE'
  | 'SHIPMENT_READY'
  | 'SHIPMENT_HANDOFF'
  | 'SHIPMENT_TRANSIT'
  | 'SHIPMENT_DELIVERED';

const ORDER_STATUS: Record<AdminOrder['status'], { label: string; tone: BadgeTone }> = {
  PENDING_PAYMENT: { label: 'در انتظار پرداخت', tone: 'warning' },
  PAID: { label: 'پرداخت‌شده', tone: 'info' },
  PROCESSING: { label: 'در حال آماده‌سازی', tone: 'info' },
  SHIPPED: { label: 'ارسال‌شده', tone: 'warning' },
  DELIVERED: { label: 'تحویل‌شده', tone: 'success' },
  CANCELLED: { label: 'لغوشده', tone: 'danger' },
  EXPIRED: { label: 'منقضی‌شده', tone: 'neutral' },
};

const ACTION_LABEL: Record<CompletionAction, string> = {
  ORDER_PROCESSING: 'شروع آماده‌سازی سفارش',
  PLATING_START: 'شروع عملیات آبکاری',
  PLATING_COMPLETE: 'تکمیل عملیات آبکاری',
  SHIPMENT_CREATE: 'ساخت مرسوله',
  SHIPMENT_READY: 'ثبت آماده‌بودن مرسوله',
  SHIPMENT_HANDOFF: 'تحویل مرسوله به ارسال‌کننده',
  SHIPMENT_TRANSIT: 'ثبت مرسوله در مسیر',
  SHIPMENT_DELIVERED: 'ثبت تحویل به مشتری',
};

const SHIPMENT_ACTION_STATUS: Partial<Record<CompletionAction, AdminShipmentStatus>> = {
  SHIPMENT_READY: 'READY',
  SHIPMENT_HANDOFF: 'HANDED_OVER',
  SHIPMENT_TRANSIT: 'IN_TRANSIT',
  SHIPMENT_DELIVERED: 'DELIVERED',
};

function nextAction(
  order: AdminOrder,
  plating: AdminPlatingOrder | undefined,
): CompletionAction | null {
  if (order.status === 'PAID') return 'ORDER_PROCESSING';
  if (!['PROCESSING', 'SHIPPED'].includes(order.status)) return null;
  if (order.platingTotalToman > 0) {
    if (!plating || plating.fulfillmentStatus === 'PENDING') return 'PLATING_START';
    if (plating.fulfillmentStatus === 'IN_PROGRESS') return 'PLATING_COMPLETE';
    if (plating.fulfillmentStatus === 'CANCELLED') return null;
  }
  if (!order.shipment) return 'SHIPMENT_CREATE';
  if (order.shipment.status === 'PENDING') return 'SHIPMENT_READY';
  if (order.shipment.status === 'READY') return 'SHIPMENT_HANDOFF';
  if (order.shipment.status === 'HANDED_OVER') return 'SHIPMENT_TRANSIT';
  if (order.shipment.status === 'IN_TRANSIT') return 'SHIPMENT_DELIVERED';
  return null;
}

function actionPermission(
  action: CompletionAction,
  permissions: Pick<Props, 'canUpdateStatus' | 'canCreateShipment' | 'canCompletePlating'>,
) {
  if (action === 'SHIPMENT_CREATE') return permissions.canCreateShipment;
  if (action === 'PLATING_COMPLETE') return permissions.canCompletePlating;
  return permissions.canUpdateStatus;
}

function operationalStage(order: AdminOrder, plating: AdminPlatingOrder | undefined): string {
  const action = nextAction(order, plating);
  if (action) return ACTION_LABEL[action];
  if (order.status === 'DELIVERED' || order.shipment?.status === 'DELIVERED') return 'تکمیل‌شده';
  if (plating?.fulfillmentStatus === 'CANCELLED') return 'آبکاری لغوشده؛ نیازمند بررسی';
  if (order.shipment?.status === 'FAILED') return 'ارسال ناموفق؛ نیازمند بررسی';
  return 'اقدام دیگری در دسترس نیست';
}

function mutationError(status: number): string {
  if (status === 401) return 'نشست مدیریتی منقضی شده است. دوباره وارد شوید.';
  if (status === 403) return 'مجوز انجام این عملیات را ندارید.';
  if (status === 404) return 'سفارش یا عملیات مرتبط پیدا نشد.';
  if (status === 409) return 'وضعیت سفارش تغییر کرده است؛ صفحه را تازه‌سازی کنید.';
  if (status === 400 || status === 422)
    return 'اطلاعات عملیات معتبر نیست یا پیش‌نیاز مرحله فراهم نشده است.';
  return 'عملیات تکمیل سفارش انجام نشد. دوباره تلاش کنید.';
}

function StageSummary({
  order,
  plating,
}: Readonly<{ order: AdminOrder; plating: AdminPlatingOrder | undefined }>) {
  const steps = [
    { label: 'پرداخت', complete: order.payment?.status === 'PAID' },
    {
      label: 'آماده‌سازی',
      complete: ['PROCESSING', 'SHIPPED', 'DELIVERED'].includes(order.status),
    },
    {
      label: 'آبکاری',
      complete: order.platingTotalToman === 0 || plating?.fulfillmentStatus === 'COMPLETED',
      skipped: order.platingTotalToman === 0,
    },
    { label: 'مرسوله', complete: Boolean(order.shipment) },
    {
      label: 'ارسال',
      complete: ['HANDED_OVER', 'IN_TRANSIT', 'DELIVERED'].includes(order.shipment?.status ?? ''),
    },
    { label: 'تحویل', complete: order.status === 'DELIVERED' },
  ];
  return (
    <ol className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {steps.map((step, index) => (
        <li
          key={step.label}
          className={`rounded-[var(--admin-radius-md)] border p-3 ${
            step.complete
              ? 'border-emerald-200 bg-emerald-50/60'
              : 'border-[var(--admin-color-border)] bg-[var(--admin-color-surface-subtle)]'
          }`}
        >
          <p className="text-[0.6875rem] text-[var(--admin-color-muted)]">
            مرحله {formatAdminInteger(index + 1)}
          </p>
          <p className="mt-1 text-sm font-bold">{step.label}</p>
          <p className="mt-1 text-xs text-[var(--admin-color-muted)]">
            {step.skipped ? 'نیاز ندارد' : step.complete ? 'انجام‌شده' : 'در انتظار'}
          </p>
        </li>
      ))}
    </ol>
  );
}

export function OrderCompletionCenter({
  orders,
  platingOrders,
  carriers,
  failed,
  canUpdateStatus,
  canCreateShipment,
  canCompletePlating,
}: Props) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [note, setNote] = useState('');
  const [actualCost, setActualCost] = useState('');
  const [externalReference, setExternalReference] = useState('');
  const [carrierSelection, setCarrierSelection] = useState(carriers[0]?.id ?? 'custom');
  const [serviceName, setServiceName] = useState('ارسال استاندارد');
  const [estimatedDays, setEstimatedDays] = useState('۳');
  const [trackingCode, setTrackingCode] = useState('');
  const [sendCustomerSms, setSendCustomerSms] = useState(true);
  const platingByOrder = useMemo(
    () => new Map(platingOrders.map((item) => [item.orderId, item])),
    [platingOrders],
  );
  const activeOrders = useMemo(
    () =>
      orders.filter(
        (order) =>
          order.payment?.status === 'PAID' &&
          ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'].includes(order.status),
      ),
    [orders],
  );
  const needle = toAsciiDigits(query).trim().toLocaleLowerCase('fa');
  const filtered = useMemo(
    () =>
      activeOrders.filter((order) => {
        if (!needle) return true;
        return [
          order.orderNumber,
          order.customer.name ?? '',
          order.customer.phone,
          ...order.items.flatMap((item) => [item.productName, item.sku]),
        ].some((value) => toAsciiDigits(value).toLocaleLowerCase('fa').includes(needle));
      }),
    [activeOrders, needle],
  );
  const selectedOrder = activeOrders.find((order) => order.id === selectedOrderId) ?? null;
  const selectedPlating = selectedOrder ? platingByOrder.get(selectedOrder.id) : undefined;
  const selectedAction = selectedOrder ? nextAction(selectedOrder, selectedPlating) : null;
  const canPerform = selectedAction
    ? actionPermission(selectedAction, { canUpdateStatus, canCreateShipment, canCompletePlating })
    : false;

  function openOrder(order: AdminOrder) {
    setSelectedOrderId(order.id);
    setNote('');
    setActualCost('');
    setExternalReference('');
    setCarrierSelection(order.shippingSelection?.carrierId ?? carriers[0]?.id ?? 'custom');
    setServiceName(order.shippingSelection?.carrierName ?? 'ارسال استاندارد');
    setEstimatedDays('۳');
    setTrackingCode(order.shipment?.trackingCode ?? '');
    setSendCustomerSms(true);
    setError('');
    setSuccess('');
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedOrder || !selectedAction || !canPerform || pending) return;
    const cleanNote = note.trim();
    let endpoint = '';
    let method: 'POST' | 'PATCH' = 'POST';
    let payload: Record<string, string | number | boolean> = {};

    if (selectedAction === 'ORDER_PROCESSING') {
      endpoint = `/api/orders/${encodeURIComponent(selectedOrder.id)}/status`;
      method = 'PATCH';
      payload = {
        status: 'PROCESSING',
        sendCustomerSms,
        ...(cleanNote ? { reason: cleanNote } : {}),
      };
    } else if (selectedAction === 'PLATING_START') {
      endpoint = `/api/plating-operations/orders/${encodeURIComponent(selectedOrder.id)}/start`;
      payload = cleanNote ? { note: cleanNote } : {};
    } else if (selectedAction === 'PLATING_COMPLETE') {
      const cost = Number(
        toAsciiDigits(actualCost)
          .replace(/[,٬\s]/g, '')
          .trim(),
      );
      if (!Number.isSafeInteger(cost) || cost < 0) {
        setError('هزینه واقعی آبکاری را به‌صورت عدد صحیح و غیرمنفی وارد کنید.');
        return;
      }
      endpoint = `/api/plating-operations/orders/${encodeURIComponent(selectedOrder.id)}/complete`;
      payload = {
        actualCostToman: cost,
        ...(externalReference.trim()
          ? { externalReference: toAsciiDigits(externalReference).trim() }
          : {}),
        ...(cleanNote ? { note: cleanNote } : {}),
      };
    } else if (selectedAction === 'SHIPMENT_CREATE') {
      const days = Number(toAsciiDigits(estimatedDays));
      const orderCarrierId = selectedOrder.shippingSelection?.carrierId;
      const selectedCarrier = carriers.find((carrier) => carrier.id === carrierSelection);
      if (
        (!orderCarrierId && !selectedCarrier && serviceName.trim().length < 2) ||
        !Number.isInteger(days) ||
        days < 1 ||
        days > 30
      ) {
        setError('شرکت ارسال و زمان تحویل بین ۱ تا ۳۰ روز را درست وارد کنید.');
        return;
      }
      endpoint = `/api/shipping/orders/${encodeURIComponent(selectedOrder.id)}/manual`;
      payload = {
        ...(orderCarrierId
          ? { carrierId: orderCarrierId }
          : selectedCarrier
            ? { carrierId: selectedCarrier.id }
            : { serviceName: serviceName.trim() }),
        estimatedDeliveryDays: days,
        ...(cleanNote ? { reason: cleanNote } : {}),
      };
    } else {
      const shipmentStatus = SHIPMENT_ACTION_STATUS[selectedAction];
      if (!shipmentStatus) return;
      endpoint = `/api/shipping/orders/${encodeURIComponent(selectedOrder.id)}/status`;
      method = 'PATCH';
      const tracking = toAsciiDigits(trackingCode).trim();
      payload = {
        status: shipmentStatus,
        sendCustomerSms,
        ...(tracking ? { trackingCode: tracking } : {}),
        ...(cleanNote ? { reason: cleanNote } : {}),
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
      if (!response.ok) {
        setError(mutationError(response.status));
        return;
      }
      setSuccess(`${ACTION_LABEL[selectedAction]} با موفقیت ثبت شد.`);
      setNote('');
      router.refresh();
    } catch {
      setError('ارتباط با سرور برقرار نشد. دوباره تلاش کنید.');
    } finally {
      setPending(false);
    }
  }

  const columns: readonly DataTableColumn<AdminOrder>[] = [
    {
      id: 'order',
      header: 'سفارش',
      cell: (order) => (
        <div>
          <p className="font-bold">{toPersianDigits(order.orderNumber)}</p>
          <p className="mt-1 text-xs text-[var(--admin-color-muted)]">
            {order.customer.name ?? order.customer.phone}
          </p>
        </div>
      ),
    },
    {
      id: 'status',
      header: 'وضعیت',
      cell: (order) => {
        const item = ORDER_STATUS[order.status];
        return <Badge tone={item.tone}>{item.label}</Badge>;
      },
    },
    {
      id: 'stage',
      header: 'اقدام بعدی',
      cell: (order) => operationalStage(order, platingByOrder.get(order.id)),
    },
    {
      id: 'updated',
      header: 'آخرین تغییر',
      visibility: 'lg',
      cell: (order) => formatAdminDateTime(order.updatedAt),
    },
    {
      id: 'action',
      header: 'عملیات',
      align: 'end',
      cell: (order) => (
        <Button size="sm" onClick={() => openOrder(order)}>
          تکمیل سفارش
        </Button>
      ),
    },
  ];

  return (
    <section aria-labelledby="order-completion-heading" className="space-y-4">
      <div>
        <h2 id="order-completion-heading" className="text-lg font-black">
          مرکز تکمیل سفارش
        </h2>
        <p className="mt-1 text-xs leading-6 text-[var(--admin-color-muted)]">
          تمام مراحل آماده‌سازی، آبکاری، ساخت مرسوله، ارسال و تحویل را از همین بخش انجام دهید.
        </p>
      </div>
      {failed ? (
        <Alert tone="danger">
          اطلاعات تکمیلی بعضی سفارش‌ها دریافت نشد؛ صفحه را تازه‌سازی کنید.
        </Alert>
      ) : null}
      <SearchField
        aria-label="جستجوی سفارش برای تکمیل"
        value={query}
        placeholder="شماره سفارش، مشتری یا محصول"
        onChange={(event) => setQuery(toPersianDigits(event.target.value))}
      />
      <ResponsiveDataView
        caption="سفارش‌های در جریان تکمیل"
        mobileLabel="کارت‌های تکمیل سفارش"
        columns={columns}
        rows={filtered}
        getRowKey={(order) => order.id}
        emptyTitle="سفارش فعالی برای تکمیل وجود ندارد"
        renderMobileCard={(order) => (
          <Card>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-bold">{toPersianDigits(order.orderNumber)}</p>
                <p className="mt-1 text-xs text-[var(--admin-color-muted)]">
                  {order.customer.name ?? order.customer.phone}
                </p>
              </div>
              <Badge tone={ORDER_STATUS[order.status].tone}>
                {ORDER_STATUS[order.status].label}
              </Badge>
            </div>
            <p className="mt-3 text-xs leading-6 text-[var(--admin-color-muted)]">
              اقدام بعدی: {operationalStage(order, platingByOrder.get(order.id))}
            </p>
            <Button className="mt-3 w-full" size="sm" onClick={() => openOrder(order)}>
              تکمیل سفارش
            </Button>
          </Card>
        )}
      />

      <Dialog
        open={selectedOrder !== null}
        onOpenChange={(open) => {
          if (!open && !pending) setSelectedOrderId(null);
        }}
      >
        <DialogContent
          size="lg"
          title={
            selectedOrder
              ? `تکمیل سفارش ${toPersianDigits(selectedOrder.orderNumber)}`
              : 'تکمیل سفارش'
          }
          description="مرحله فعلی و اقدام بعدی را بررسی و ثبت کنید."
          hideClose={pending}
        >
          {selectedOrder ? (
            <form onSubmit={submit} className="space-y-4">
              {success ? <Alert tone="success">{success}</Alert> : null}
              {error ? <Alert tone="danger">{error}</Alert> : null}
              <StageSummary order={selectedOrder} plating={selectedPlating} />
              <Card title="خلاصه سفارش">
                <div className="grid grid-cols-2 gap-3 text-xs sm:text-sm">
                  <p>تعداد اقلام: {formatAdminInteger(selectedOrder.items.length)}</p>
                  <p>مبلغ: {formatAdminToman(selectedOrder.grandTotalToman)}</p>
                  <p>آبکاری: {formatAdminToman(selectedOrder.platingTotalToman)}</p>
                  <p>ارسال: {formatAdminToman(selectedOrder.shippingTotalToman)}</p>
                </div>
              </Card>
              {selectedAction ? (
                <Card title={`اقدام بعدی: ${ACTION_LABEL[selectedAction]}`}>
                  <div className="space-y-4">
                    {selectedAction === 'PLATING_COMPLETE' ? (
                      <>
                        <FormField
                          id="completion-plating-cost"
                          label="هزینه واقعی آبکاری (تومان)"
                          required
                        >
                          {(props) => (
                            <MoneyInput
                              {...props}
                              value={actualCost}
                              onChange={(event) => setActualCost(event.target.value)}
                              disabled={pending}
                            />
                          )}
                        </FormField>
                        <FormField
                          id="completion-plating-reference"
                          label="شماره فاکتور یا مرجع کارگاه"
                        >
                          {(props) => (
                            <Input
                              {...props}
                              value={externalReference}
                              maxLength={255}
                              onChange={(event) => setExternalReference(event.target.value)}
                              disabled={pending}
                            />
                          )}
                        </FormField>
                      </>
                    ) : null}
                    {selectedAction === 'SHIPMENT_CREATE' ? (
                      <>
                        {selectedOrder.shippingSelection ? (
                          <Alert tone="info">
                            شرکت انتخاب‌شده مشتری: {selectedOrder.shippingSelection.carrierName}
                          </Alert>
                        ) : (
                          <FormField id="completion-carrier" label="شرکت ارسال‌کننده" required>
                            {(props) => (
                              <Select
                                {...props}
                                value={carrierSelection}
                                options={[
                                  ...carriers.map((carrier) => ({
                                    value: carrier.id,
                                    label: carrier.name,
                                  })),
                                  { value: 'custom', label: 'سایر (ورود نام دستی)' },
                                ]}
                                onValueChange={setCarrierSelection}
                                disabled={pending}
                              />
                            )}
                          </FormField>
                        )}
                        {!selectedOrder.shippingSelection && carrierSelection === 'custom' ? (
                          <FormField id="completion-service-name" label="نام شیوه ارسال" required>
                            {(props) => (
                              <Input
                                {...props}
                                value={serviceName}
                                maxLength={200}
                                onChange={(event) => setServiceName(event.target.value)}
                                disabled={pending}
                              />
                            )}
                          </FormField>
                        ) : null}
                        <FormField
                          id="completion-estimated-days"
                          label="زمان تقریبی تحویل"
                          required
                        >
                          {(props) => (
                            <Input
                              {...props}
                              inputMode="numeric"
                              value={estimatedDays}
                              onChange={(event) => setEstimatedDays(event.target.value)}
                              disabled={pending}
                            />
                          )}
                        </FormField>
                      </>
                    ) : null}
                    {selectedAction === 'SHIPMENT_HANDOFF' &&
                    selectedOrder.shipment?.deliveryType !== 'COURIER' ? (
                      <FormField
                        id="completion-tracking-code"
                        label="کد رهگیری (اختیاری)"
                        hint="در صورت ثبت، برای مشتری نمایش داده می‌شود."
                      >
                        {(props) => (
                          <Input
                            {...props}
                            dir="ltr"
                            value={trackingCode}
                            maxLength={255}
                            onChange={(event) => setTrackingCode(event.target.value)}
                            disabled={pending}
                          />
                        )}
                      </FormField>
                    ) : null}
                    {['ORDER_PROCESSING', 'SHIPMENT_HANDOFF', 'SHIPMENT_DELIVERED'].includes(
                      selectedAction,
                    ) ? (
                      <Checkbox
                        id="completion-send-customer-sms"
                        checked={sendCustomerSms}
                        label="ارسال پیامک این مرحله به مشتری"
                        onChange={(event) => setSendCustomerSms(event.target.checked)}
                        disabled={pending}
                      />
                    ) : null}
                    <FormField
                      id="completion-operation-note"
                      label="یادداشت عملیات (اختیاری)"
                      hint="در صورت نیاز برای سابقه داخلی ثبت کنید."
                    >
                      {(props) => (
                        <Textarea
                          {...props}
                          value={note}
                          maxLength={1000}
                          onChange={(event) => setNote(event.target.value)}
                          disabled={pending}
                        />
                      )}
                    </FormField>
                    {canPerform ? (
                      <Button type="submit" className="w-full" loading={pending}>
                        {ACTION_LABEL[selectedAction]}
                      </Button>
                    ) : (
                      <Alert tone="warning">مجوز انجام این مرحله را ندارید.</Alert>
                    )}
                  </div>
                </Card>
              ) : (
                <Alert tone={selectedOrder.status === 'DELIVERED' ? 'success' : 'warning'}>
                  {operationalStage(selectedOrder, selectedPlating)}
                </Alert>
              )}
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}
