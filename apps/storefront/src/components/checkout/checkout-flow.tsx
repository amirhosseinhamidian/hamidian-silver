'use client';

import type { components } from '@hamidian/contracts';
import { useEffect, useState, type FormEvent } from 'react';

import { Button, ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input, Select, Textarea } from '@/components/ui/form-control';
import { FormField } from '@/components/ui/form-field';
import { formatTomanPrice } from '@/lib/catalog/presentation';
import { useCart } from '@/lib/cart/cart-store';
import { buildCreateOrderBody } from '@/lib/checkout/checkout-payload';

type CurrentUser = components['schemas']['CurrentUserResponseDto'];
type CustomerOrderDetail = components['schemas']['CustomerOrderDetailDto'];
type PaymentInitiationResponse = components['schemas']['PaymentInitiationResponseDto'];
type PaymentProvider = NonNullable<components['schemas']['InitiatePaymentDto']['provider']>;

type AuthState =
  | { status: 'checking' }
  | { status: 'anonymous' }
  | { status: 'authenticated'; user: CurrentUser };

const providerLabels: Record<PaymentProvider, string> = {
  zarinpal: 'زرین‌پال',
  zibal: 'زیبال',
  mellat: 'به‌پرداخت ملت',
};

function normalizeDigits(value: string): string {
  const persianDigits = '۰۱۲۳۴۵۶۷۸۹';
  const arabicDigits = '٠١٢٣٤٥٦٧٨٩';

  return [...value.trim()]
    .map((character) => {
      const persianIndex = persianDigits.indexOf(character);
      if (persianIndex >= 0) return String(persianIndex);

      const arabicIndex = arabicDigits.indexOf(character);
      if (arabicIndex >= 0) return String(arabicIndex);

      return character;
    })
    .join('');
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { message?: string | string[] };
    const message = payload.message;

    if (Array.isArray(message)) {
      return message.join('، ');
    }

    if (typeof message === 'string' && message) {
      return message;
    }
  } catch {
    // Fall through to the generic message.
  }

  return 'امکان انجام درخواست وجود ندارد. دوباره تلاش کنید.';
}

export function CheckoutFlow() {
  const { items, itemCount, subtotalToman, clearCart } = useCart();
  const [auth, setAuth] = useState<AuthState>({ status: 'checking' });
  const [phone, setPhone] = useState('');
  const [otpRequested, setOtpRequested] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
  const [completedOrderNumber, setCompletedOrderNumber] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    void fetch('/api/auth/me', { cache: 'no-store' })
      .then(async (response) => {
        if (!active) return;

        if (response.ok) {
          const user = (await response.json()) as CurrentUser;
          setAuth({ status: 'authenticated', user });
          setPhone(user.phone);
          return;
        }

        setAuth({ status: 'anonymous' });
      })
      .catch(() => {
        if (active) {
          setAuth({ status: 'anonymous' });
        }
      });

    return () => {
      active = false;
    };
  }, []);

  async function requestOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthLoading(true);
    setAuthError(null);

    try {
      const normalizedPhone = normalizeDigits(phone);
      const response = await fetch('/api/auth/otp/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: normalizedPhone }),
      });

      if (!response.ok) {
        setAuthError(await readErrorMessage(response));
        return;
      }

      setPhone(normalizedPhone);
      setOtpRequested(true);
    } catch {
      setAuthError('ارتباط با سرویس ورود برقرار نشد. دوباره تلاش کنید.');
    } finally {
      setAuthLoading(false);
    }
  }

  async function verifyOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthLoading(true);
    setAuthError(null);

    try {
      const formData = new FormData(event.currentTarget);
      const code = normalizeDigits(String(formData.get('code') ?? ''));
      const response = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code }),
      });

      if (!response.ok) {
        setAuthError(await readErrorMessage(response));
        return;
      }

      const meResponse = await fetch('/api/auth/me', { cache: 'no-store' });

      if (!meResponse.ok) {
        setAuthError('ورود انجام شد اما دریافت اطلاعات حساب ناموفق بود.');
        return;
      }

      setAuth({ status: 'authenticated', user: (await meResponse.json()) as CurrentUser });
    } catch {
      setAuthError('ارتباط با سرویس ورود برقرار نشد. دوباره تلاش کنید.');
    } finally {
      setAuthLoading(false);
    }
  }

  async function submitCheckout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (auth.status !== 'authenticated' || items.length === 0) {
      return;
    }

    setCheckoutLoading(true);
    setCheckoutError(null);

    try {
      const formData = new FormData(event.currentTarget);
      let orderId = pendingOrderId;
      let orderNumber = completedOrderNumber;

      if (!orderId) {
        const shippingAddress = {
          recipientName: String(formData.get('recipientName') ?? '').trim(),
          phone: normalizeDigits(String(formData.get('shippingPhone') ?? '')),
          province: String(formData.get('province') ?? '').trim(),
          city: String(formData.get('city') ?? '').trim(),
          addressLine: String(formData.get('addressLine') ?? '').trim(),
          postalCode: normalizeDigits(String(formData.get('postalCode') ?? '')),
        };
        const orderResponse = await fetch('/api/checkout/order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(buildCreateOrderBody(items, shippingAddress)),
        });

        if (!orderResponse.ok) {
          setCheckoutError(await readErrorMessage(orderResponse));
          return;
        }

        const order = (await orderResponse.json()) as CustomerOrderDetail;
        orderId = order.id;
        orderNumber = order.orderNumber;
        setPendingOrderId(order.id);
        setCompletedOrderNumber(order.orderNumber);
      }

      const provider = String(formData.get('provider') ?? 'zarinpal') as PaymentProvider;
      const paymentResponse = await fetch('/api/checkout/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          idempotencyKey: crypto.randomUUID(),
          provider,
        }),
      });

      if (!paymentResponse.ok) {
        setCheckoutError(
          `${await readErrorMessage(paymentResponse)} سفارش ${orderNumber ?? ''} ثبت شده و می‌توانید پرداخت را دوباره تلاش کنید.`,
        );
        return;
      }

      const payment = (await paymentResponse.json()) as PaymentInitiationResponse;

      if (payment.alreadyPaid) {
        clearCart();
        setPendingOrderId(null);
        setCompletedOrderNumber(orderNumber);
        return;
      }

      if (!payment.paymentUrl) {
        setCheckoutError('درگاه پرداخت آدرس انتقال معتبر برنگرداند.');
        return;
      }

      clearCart();
      window.location.assign(payment.paymentUrl);
    } catch {
      setCheckoutError('ارتباط با سرویس سفارش یا پرداخت برقرار نشد. دوباره تلاش کنید.');
    } finally {
      setCheckoutLoading(false);
    }
  }

  if (items.length === 0 && !completedOrderNumber) {
    return (
      <div className="py-10">
        <EmptyState
          title="سبد خرید شما خالی است"
          description="برای ثبت سفارش ابتدا محصولی به سبد خرید اضافه کنید."
          action={<ButtonLink href="/products">مشاهده محصولات</ButtonLink>}
        />
      </div>
    );
  }

  if (completedOrderNumber && items.length === 0) {
    return (
      <div className="py-10">
        <EmptyState
          title="سفارش ثبت شد"
          description={`شماره سفارش ${completedOrderNumber} ثبت شده است.`}
          action={<ButtonLink href="/products">بازگشت به فروشگاه</ButtonLink>}
        />
      </div>
    );
  }

  if (auth.status === 'checking') {
    return <p className="py-10 text-sm text-[var(--sf-color-muted)]">در حال بررسی حساب کاربری…</p>;
  }

  if (auth.status === 'anonymous') {
    return (
      <section className="mx-auto max-w-lg py-10">
        <h2 className="text-xl font-medium">ورود برای ادامه خرید</h2>
        <p className="mt-2 text-sm leading-7 text-[var(--sf-color-muted)]">
          ورود با شماره موبایل انجام می‌شود و نشست کاربری فقط در کوکی امن HttpOnly نگهداری می‌شود.
        </p>

        {!otpRequested ? (
          <form className="mt-7 grid gap-5" onSubmit={requestOtp}>
            <FormField id="checkout-login-phone" label="شماره موبایل" required error={authError}>
              {(controlProps) => (
                <Input
                  {...controlProps}
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="09120000000"
                  required
                />
              )}
            </FormField>
            <Button type="submit" loading={authLoading} className="w-full">
              دریافت کد ورود
            </Button>
          </form>
        ) : (
          <form className="mt-7 grid gap-5" onSubmit={verifyOtp}>
            <p className="text-sm text-[var(--sf-color-muted)]">کد ارسال‌شده به {phone}</p>
            <FormField id="checkout-login-code" label="کد شش رقمی" required error={authError}>
              {(controlProps) => (
                <Input
                  {...controlProps}
                  name="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="------"
                  required
                />
              )}
            </FormField>
            <Button type="submit" loading={authLoading} className="w-full">
              ورود و ادامه
            </Button>
            <Button
              type="button"
              variant="text"
              onClick={() => {
                setOtpRequested(false);
                setAuthError(null);
              }}
            >
              اصلاح شماره موبایل
            </Button>
          </form>
        )}
      </section>
    );
  }

  return (
    <form className="grid gap-10 py-10 lg:grid-cols-[minmax(0,1fr)_22rem]" onSubmit={submitCheckout}>
      <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-medium">اطلاعات ارسال</h2>
            <p className="mt-2 text-sm text-[var(--sf-color-muted)]">ورود با {auth.user.phone}</p>
          </div>
          {pendingOrderId ? (
            <p className="text-xs text-[var(--sf-color-muted)]">
              سفارش {completedOrderNumber} ثبت شده؛ پرداخت را دوباره تلاش کنید.
            </p>
          ) : null}
        </div>

        <div className="mt-7 grid gap-5 sm:grid-cols-2">
          <FormField id="recipientName" label="نام گیرنده" required>
            {(controlProps) => <Input {...controlProps} name="recipientName" required />}
          </FormField>
          <FormField id="shippingPhone" label="شماره تماس گیرنده" required>
            {(controlProps) => (
              <Input
                {...controlProps}
                name="shippingPhone"
                type="tel"
                inputMode="tel"
                defaultValue={auth.user.phone}
                required
              />
            )}
          </FormField>
          <FormField id="province" label="استان" required>
            {(controlProps) => <Input {...controlProps} name="province" required />}
          </FormField>
          <FormField id="city" label="شهر" required>
            {(controlProps) => <Input {...controlProps} name="city" required />}
          </FormField>
          <FormField id="postalCode" label="کد پستی ۱۰ رقمی" required className="sm:col-span-2">
            {(controlProps) => (
              <Input
                {...controlProps}
                name="postalCode"
                inputMode="numeric"
                maxLength={10}
                required
              />
            )}
          </FormField>
          <FormField id="addressLine" label="نشانی کامل" required className="sm:col-span-2">
            {(controlProps) => <Textarea {...controlProps} name="addressLine" required />}
          </FormField>
        </div>
      </section>

      <aside className="h-fit border border-[var(--sf-color-border)] p-5 lg:sticky lg:top-6">
        <h2 className="text-lg font-medium">خلاصه پرداخت</h2>
        <div className="mt-5 flex items-center justify-between gap-4 text-sm">
          <span className="text-[var(--sf-color-muted)]">تعداد کالا</span>
          <span>{new Intl.NumberFormat('fa-IR').format(itemCount)}</span>
        </div>
        <div className="mt-3 flex items-center justify-between gap-4 text-sm">
          <span className="text-[var(--sf-color-muted)]">مبلغ نمایشی سبد</span>
          <span>{formatTomanPrice(subtotalToman)}</span>
        </div>
        <p className="mt-4 text-xs leading-6 text-[var(--sf-color-muted)]">
          مبلغ، موجودی و هزینه آبکاری هنگام ثبت سفارش دوباره توسط سرور محاسبه می‌شود.
        </p>

        <div className="mt-6">
          <FormField id="provider" label="درگاه پرداخت" required>
            {(controlProps) => (
              <Select {...controlProps} name="provider" defaultValue="zarinpal" required>
                {Object.entries(providerLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            )}
          </FormField>
        </div>

        {checkoutError ? (
          <p role="alert" className="mt-5 text-xs leading-6 text-[var(--sf-color-ink)]">
            {checkoutError}
          </p>
        ) : null}

        <Button type="submit" loading={checkoutLoading} className="mt-6 w-full">
          {pendingOrderId ? 'تلاش مجدد برای پرداخت' : 'ثبت سفارش و پرداخت'}
        </Button>
        <ButtonLink href="/cart" variant="text" className="mt-3 w-full">
          بازگشت به سبد خرید
        </ButtonLink>
      </aside>
    </form>
  );
}
