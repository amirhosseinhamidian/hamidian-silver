'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/form-control';
import { FormField } from '@/components/ui/form-field';
import type { AdminOrder, AdminOrderStatus } from '@/lib/orders/orders-model';
import { formatAdminDateTime, toPersianDigits } from '@/lib/presentation/formatters';

type OrderOperationsProps = Readonly<{
  order: AdminOrder;
  canUpdateStatus: boolean;
  canCancel: boolean;
}>;

type OrderAction = 'status' | 'cancel' | 'return-authorization';

const orderStatusLabels: Record<AdminOrderStatus, string> = {
  PENDING_PAYMENT: 'در انتظار پرداخت',
  PAID: 'پرداخت‌شده',
  PROCESSING: 'در حال پردازش',
  SHIPPED: 'ارسال‌شده',
  DELIVERED: 'تحویل‌شده',
  CANCELLED: 'لغوشده',
  EXPIRED: 'منقضی‌شده',
};

const nextOrderStatuses: Partial<Record<AdminOrderStatus, AdminOrderStatus>> = {
  PAID: 'PROCESSING',
  PROCESSING: 'SHIPPED',
  SHIPPED: 'DELIVERED',
};

function statusActionLabel(status: AdminOrderStatus): string {
  if (status === 'PROCESSING') return 'شروع پردازش سفارش';
  if (status === 'SHIPPED') return 'ثبت ارسال سفارش';
  return 'ثبت تحویل سفارش';
}

function statusTransitionBlocker(order: AdminOrder, nextStatus: AdminOrderStatus): string | null {
  if (nextStatus === 'PROCESSING' && order.payment?.status !== 'PAID') {
    return 'شروع پردازش فقط پس از تسویه کامل پرداخت امکان‌پذیر است.';
  }

  if (
    nextStatus === 'SHIPPED' &&
    !['HANDED_OVER', 'IN_TRANSIT', 'DELIVERED'].includes(order.shipment?.status ?? '')
  ) {
    return 'پیش از ثبت ارسال، مرسوله باید ساخته و به ارسال‌کننده تحویل شده باشد.';
  }

  if (nextStatus === 'DELIVERED' && order.shipment?.status !== 'DELIVERED') {
    return 'تحویل سفارش فقط پس از ثبت تحویل مرسوله امکان‌پذیر است.';
  }

  return null;
}

function mutationErrorMessage(status: number): string {
  if (status === 401) return 'نشست مدیریتی منقضی شده است. دوباره وارد شوید.';
  if (status === 403) return 'مجوز انجام این عملیات را ندارید.';
  if (status === 404) return 'سفارش پیدا نشد یا دیگر در دسترس نیست.';
  if (status === 409) return 'وضعیت سفارش تغییر کرده است؛ صفحه را تازه‌سازی و دوباره بررسی کنید.';
  if (status === 400 || status === 422) return 'اطلاعات عملیات معتبر نیست یا شرایط آن فراهم نشده است.';
  return 'عملیات سفارش انجام نشد. دوباره تلاش کنید.';
}

export function OrderOperations({ order, canUpdateStatus, canCancel }: OrderOperationsProps) {
  const router = useRouter();
  const [action, setAction] = useState<OrderAction | null>(null);
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const nextStatus = nextOrderStatuses[order.status];
  const transitionBlocker = nextStatus ? statusTransitionBlocker(order, nextStatus) : null;
  const returnEligible = order.status === 'SHIPPED' || order.status === 'DELIVERED';
  const hasAvailableAction =
    (canUpdateStatus && Boolean(nextStatus)) ||
    (canCancel && order.status === 'PENDING_PAYMENT') ||
    (canUpdateStatus && returnEligible && !order.returnAuthorization);

  if (!hasAvailableAction && !order.returnAuthorization) return null;

  function openAction(nextAction: OrderAction) {
    setAction(nextAction);
    setReason('');
    setError('');
    setSuccess('');
  }

  function closeAction() {
    if (pending) return;
    setAction(null);
    setReason('');
    setError('');
  }

  async function submitAction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!action || pending) return;
    if (action === 'status' && !nextStatus) return;

    const normalizedReason = reason.trim();
    const reasonRequired = action === 'cancel' || action === 'return-authorization';
    if (reasonRequired && normalizedReason.length < 3) {
      setError('دلیل عملیات باید حداقل ۳ نویسه باشد.');
      return;
    }

    const endpoint = `/api/orders/${encodeURIComponent(order.id)}/${action}`;
    const method = action === 'status' ? 'PATCH' : 'POST';
    const payload =
      action === 'status'
        ? { status: nextStatus, ...(normalizedReason ? { reason: normalizedReason } : {}) }
        : { reason: normalizedReason };

    setPending(true);
    setError('');

    try {
      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        setError(mutationErrorMessage(response.status));
        return;
      }

      setAction(null);
      setReason('');
      setSuccess(
        action === 'status'
          ? 'وضعیت سفارش با موفقیت به‌روزرسانی شد.'
          : action === 'cancel'
            ? 'سفارش با موفقیت لغو شد.'
            : 'مجوز مرجوعی استثنایی برای این سفارش فعال شد.',
      );
      router.refresh();
    } catch {
      setError('ارتباط با سرور برقرار نشد. دوباره تلاش کنید.');
    } finally {
      setPending(false);
    }
  }

  const dialogTitle =
    action === 'status'
      ? `تغییر وضعیت به «${nextStatus ? orderStatusLabels[nextStatus] : ''}»`
      : action === 'cancel'
        ? 'لغو سفارش'
        : 'فعال‌کردن مرجوعی استثنایی';
  const reasonRequired = action === 'cancel' || action === 'return-authorization';
  const formId = `order-${order.id}-${action ?? 'action'}-form`;

  return (
    <>
      <Card
        title="عملیات سفارش"
        description="تغییرات پس از تأیید در تاریخچه عملیاتی سفارش ثبت می‌شوند."
      >
        <div className="space-y-3">
          {success ? <Alert tone="success">{success}</Alert> : null}

          {canUpdateStatus && nextStatus ? (
            <div className="rounded-[var(--admin-radius-md)] border border-[var(--admin-color-border)] p-3">
              <p className="text-sm font-bold">مرحله بعد: {orderStatusLabels[nextStatus]}</p>
              {transitionBlocker ? (
                <p className="mt-1 text-xs leading-6 text-[var(--admin-color-warning)]">
                  {transitionBlocker}
                </p>
              ) : (
                <p className="mt-1 text-xs leading-6 text-[var(--admin-color-muted)]">
                  این تغییر برگشت‌پذیر نیست و با نام مدیر فعلی ثبت می‌شود.
                </p>
              )}
              <Button
                className="mt-3"
                size="sm"
                disabled={Boolean(transitionBlocker)}
                onClick={() => openAction('status')}
              >
                {statusActionLabel(nextStatus)}
              </Button>
            </div>
          ) : null}

          {canCancel && order.status === 'PENDING_PAYMENT' ? (
            <div className="rounded-[var(--admin-radius-md)] border border-red-200 bg-red-50/50 p-3">
              <p className="text-sm font-bold text-[var(--admin-color-danger)]">لغو مدیریتی سفارش</p>
              <p className="mt-1 text-xs leading-6 text-[var(--admin-color-muted)]">
                موجودی رزروشده آزاد می‌شود و دلیل لغو در تاریخچه ثبت خواهد شد.
              </p>
              <Button
                className="mt-3"
                variant="danger"
                size="sm"
                onClick={() => openAction('cancel')}
              >
                لغو سفارش
              </Button>
            </div>
          ) : null}

          {order.returnAuthorization ? (
            <Alert tone="success" title="مجوز مرجوعی استثنایی فعال است">
              <p>
                {toPersianDigits(order.returnAuthorization.actor)} ·{' '}
                {formatAdminDateTime(order.returnAuthorization.authorizedAt)}
              </p>
              {order.returnAuthorization.reason ? (
                <p className="mt-1">{toPersianDigits(order.returnAuthorization.reason)}</p>
              ) : null}
            </Alert>
          ) : canUpdateStatus && returnEligible ? (
            <div className="rounded-[var(--admin-radius-md)] border border-amber-200 bg-amber-50/50 p-3">
              <p className="text-sm font-bold text-[var(--admin-color-warning)]">
                مرجوعی فقط با تأیید استثنایی
              </p>
              <p className="mt-1 text-xs leading-6 text-[var(--admin-color-muted)]">
                فقط پس از بررسی ارسال اشتباه یا مشکل بحرانی، امکان درخواست مرجوعی را برای مشتری
                فعال کنید.
              </p>
              <Button
                className="mt-3"
                variant="outline"
                size="sm"
                onClick={() => openAction('return-authorization')}
              >
                بررسی و فعال‌کردن مجوز
              </Button>
            </div>
          ) : null}
        </div>
      </Card>

      <Dialog
        open={action !== null}
        onOpenChange={(open) => {
          if (!open) closeAction();
        }}
      >
        <DialogContent
          title={dialogTitle}
          description={
            action === 'return-authorization'
              ? 'این مجوز دکمه درخواست مرجوعی را برای مشتری فعال می‌کند.'
              : `سفارش ${toPersianDigits(order.orderNumber)} را پیش از تأیید نهایی بررسی کنید.`
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
                variant={action === 'cancel' ? 'danger' : 'primary'}
                loading={pending}
              >
                {action === 'status'
                  ? 'تأیید تغییر وضعیت'
                  : action === 'cancel'
                    ? 'تأیید لغو سفارش'
                    : 'تأیید مجوز مرجوعی'}
              </Button>
            </>
          }
        >
          <form id={formId} onSubmit={submitAction} className="space-y-4">
            {action === 'cancel' ? (
              <Alert tone="danger" title="این عملیات برگشت‌پذیر نیست">
                سفارش لغو و رزرو موجودی آن آزاد می‌شود.
              </Alert>
            ) : null}
            {action === 'return-authorization' ? (
              <Alert tone="warning">
                پسند نکردن محصول دلیل قابل‌قبول برای مرجوعی نیست؛ نتیجه بررسی پشتیبانی را ثبت کنید.
              </Alert>
            ) : null}
            <FormField
              id={`${formId}-reason`}
              label={action === 'status' ? 'یادداشت تغییر وضعیت' : 'دلیل عملیات'}
              required={reasonRequired}
              error={error || undefined}
              hint={action === 'status' ? 'اختیاری؛ در timeline سفارش نمایش داده می‌شود.' : undefined}
            >
              {(controlProps) => (
                <Textarea
                  {...controlProps}
                  value={reason}
                  maxLength={500}
                  placeholder={
                    action === 'return-authorization'
                      ? 'مثلاً ارسال کالای اشتباه توسط پشتیبانی تأیید شد'
                      : action === 'cancel'
                        ? 'دلیل لغو سفارش را بنویسید'
                        : 'توضیح کوتاه برای تیم عملیات'
                  }
                  onChange={(event) => setReason(toPersianDigits(event.target.value))}
                  disabled={pending}
                />
              )}
            </FormField>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
