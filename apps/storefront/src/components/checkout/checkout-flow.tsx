'use client';

import type { components } from '@hamidian/contracts';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';

import { Button, ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input, Textarea } from '@/components/ui/form-control';
import { FormField } from '@/components/ui/form-field';
import { Select } from '@/components/ui/select';
import { trackBeginCheckout } from '@/lib/analytics/commerce-events';
import { AUTHENTICATION_SUCCEEDED_EVENT, openAuthModal } from '@/lib/auth/events';
import { formatTomanPrice } from '@/lib/catalog/presentation';
import { useCart } from '@/lib/cart/cart-store';
import { buildCreateOrderBody } from '@/lib/checkout/checkout-payload';
import { cityOptionsFor, PROVINCE_OPTIONS } from '@/lib/checkout/iran-locations';

type CurrentUser = components['schemas']['CurrentUserResponseDto'];
type CustomerOrderDetail = components['schemas']['CustomerOrderDetailDto'];
type PaymentInitiationResponse = components['schemas']['PaymentInitiationResponseDto'];
type AuthState =
  | { status: 'checking' }
  | { status: 'anonymous'; expired: boolean }
  | { status: 'unavailable' }
  | { status: 'forbidden' }
  | { status: 'authenticated'; user: CurrentUser };
type CheckoutPriceChange = Readonly<{ cartSubtotalToman: number; orderTotalToman: number }>;
type UserAddress = Readonly<{
  id: string;
  title: string;
  recipientName: string;
  phone: string;
  province: string;
  city: string;
  addressLine: string;
  postalCode: string;
  isDefault: boolean;
}>;
type AddressFields = Omit<UserAddress, 'id' | 'isDefault'>;

const NEW_ADDRESS_VALUE = '__new_address__';
const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

function toAsciiDigits(value: string): string {
  return [...value]
    .map((character) => {
      const persianIndex = PERSIAN_DIGITS.indexOf(character);
      if (persianIndex >= 0) return String(persianIndex);
      const arabicIndex = ARABIC_DIGITS.indexOf(character);
      return arabicIndex >= 0 ? String(arabicIndex) : character;
    })
    .join('');
}

function toPersianDigits(value: string): string {
  return value.replace(/\d/g, (digit) => PERSIAN_DIGITS[Number(digit)] ?? digit);
}

function digitsOnly(value: string, maxLength: number): string {
  return toAsciiDigits(value).replace(/\D/g, '').slice(0, maxLength);
}

function emptyAddress(phone = ''): AddressFields {
  return {
    title: '',
    recipientName: '',
    phone: toPersianDigits(phone),
    province: '',
    city: '',
    addressLine: '',
    postalCode: '',
  };
}

function isUserAddress(value: unknown): value is UserAddress {
  if (!value || typeof value !== 'object') return false;
  const address = value as Partial<UserAddress>;
  return (
    typeof address.id === 'string' &&
    typeof address.title === 'string' &&
    typeof address.recipientName === 'string' &&
    typeof address.phone === 'string' &&
    typeof address.province === 'string' &&
    typeof address.city === 'string' &&
    typeof address.addressLine === 'string' &&
    typeof address.postalCode === 'string' &&
    typeof address.isDefault === 'boolean'
  );
}

async function readError(response: Response): Promise<{ message: string; code: string | null }> {
  if (response.status === 401) {
    return { message: 'نشست شما منقضی شده است. دوباره وارد شوید.', code: 'UNAUTHORIZED' };
  }
  if (response.status === 403) {
    return { message: 'اجازه انجام این عملیات را ندارید.', code: 'FORBIDDEN' };
  }
  if (response.status >= 500) {
    return { message: 'ارتباط با سرویس برقرار نشد. کمی بعد دوباره تلاش کنید.', code: null };
  }
  try {
    const payload = (await response.json()) as {
      message?: string | string[];
      error?: { code?: string; message?: string | string[] };
    };
    const message = payload.error?.message ?? payload.message;
    if (Array.isArray(message)) {
      return { message: message.join('، '), code: payload.error?.code ?? null };
    }
    if (typeof message === 'string' && message) {
      return { message, code: payload.error?.code ?? null };
    }
  } catch {
    // Use the generic message below.
  }
  return { message: 'امکان انجام درخواست وجود ندارد. دوباره تلاش کنید.', code: null };
}

export function CheckoutFlow() {
  const { items, itemCount, subtotalToman, clearCart } = useCart();
  const [auth, setAuth] = useState<AuthState>({ status: 'checking' });
  const [addresses, setAddresses] = useState<UserAddress[]>([]);
  const [addressesLoading, setAddressesLoading] = useState(true);
  const [addressError, setAddressError] = useState<string | null>(null);
  const [selectedAddressId, setSelectedAddressId] = useState(NEW_ADDRESS_VALUE);
  const [addressFields, setAddressFields] = useState<AddressFields>(() => emptyAddress());
  const [saveAddress, setSaveAddress] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
  const [pendingOrderTotalToman, setPendingOrderTotalToman] = useState<number | null>(null);
  const [priceChange, setPriceChange] = useState<CheckoutPriceChange | null>(null);
  const [completedOrderNumber, setCompletedOrderNumber] = useState<string | null>(null);
  const [staleCart, setStaleCart] = useState(false);
  const [uncertainCheckout, setUncertainCheckout] = useState<'order' | 'payment' | null>(null);
  const paymentIdempotencyKey = useRef<string | null>(null);
  const checkoutTracked = useRef(false);

  const selectedAddress = useMemo(
    () => addresses.find(({ id }) => id === selectedAddressId) ?? null,
    [addresses, selectedAddressId],
  );
  const provinceOptions = useMemo(() => {
    if (
      !addressFields.province ||
      PROVINCE_OPTIONS.some(({ value }) => value === addressFields.province)
    ) {
      return PROVINCE_OPTIONS;
    }
    return [{ value: addressFields.province, label: addressFields.province }, ...PROVINCE_OPTIONS];
  }, [addressFields.province]);
  const cityOptions = useMemo(() => {
    const options = cityOptionsFor(addressFields.province);
    return !addressFields.city || options.some(({ value }) => value === addressFields.city)
      ? options
      : [{ value: addressFields.city, label: addressFields.city }, ...options];
  }, [addressFields.city, addressFields.province]);

  useEffect(() => {
    if (checkoutTracked.current || items.length === 0) {
      return;
    }

    checkoutTracked.current = true;
    trackBeginCheckout(
      subtotalToman,
      items.map((item) => ({
        itemId: item.productSlug,
        itemName: item.productName,
        variant: [item.variantLabel, item.platingType].filter(Boolean).join(' / '),
        priceToman: item.unitSalePriceToman + item.unitPlatingPriceToman,
        quantity: item.quantity,
      })),
    );
  }, [items, subtotalToman]);

  useEffect(() => {
    let active = true;
    void fetch('/api/auth/me', { cache: 'no-store' })
      .then(async (response) => {
        if (!active) return;
        if (response.status === 401) return setAuth({ status: 'anonymous', expired: true });
        if (response.status === 403) return setAuth({ status: 'forbidden' });
        if (!response.ok) return setAuth({ status: 'unavailable' });
        const user = (await response.json()) as CurrentUser;
        setAuth({ status: 'authenticated', user });
        setAddressFields(emptyAddress(user.phone));
      })
      .catch(() => active && setAuth({ status: 'unavailable' }));
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const resumeCheckout = () => window.location.reload();
    window.addEventListener(AUTHENTICATION_SUCCEEDED_EVENT, resumeCheckout);
    return () => window.removeEventListener(AUTHENTICATION_SUCCEEDED_EVENT, resumeCheckout);
  }, []);

  useEffect(() => {
    if (auth.status !== 'authenticated') return;
    let active = true;
    void fetch('/api/profile/addresses', { cache: 'no-store' })
      .then(async (response) => {
        if (!active) return;
        if (response.status === 401) return setAuth({ status: 'anonymous', expired: true });
        if (!response.ok) return setAddressError((await readError(response)).message);
        const payload: unknown = await response.json();
        const nextAddresses = Array.isArray(payload) ? payload.filter(isUserAddress) : [];
        setAddresses(nextAddresses);
        const preferred = nextAddresses.find(({ isDefault }) => isDefault) ?? nextAddresses[0];
        if (preferred) setSelectedAddressId(preferred.id);
      })
      .catch(() => active && setAddressError('دریافت آدرس‌های ذخیره‌شده انجام نشد.'))
      .finally(() => active && setAddressesLoading(false));
    return () => {
      active = false;
    };
  }, [auth.status]);

  function updateField<Key extends keyof AddressFields>(key: Key, value: AddressFields[Key]) {
    setAddressFields((current) => ({ ...current, [key]: value }));
  }

  function selectAddress(value: string) {
    if (!value) return;

    setSelectedAddressId(value);
    setCheckoutError(null);
    if (value === NEW_ADDRESS_VALUE && auth.status === 'authenticated') {
      setAddressFields(emptyAddress(auth.user.phone));
    }
  }

  async function saveNewAddress(): Promise<UserAddress | null> {
    const response = await fetch('/api/profile/addresses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: addressFields.title.trim(),
        recipientName: addressFields.recipientName.trim(),
        phone: toAsciiDigits(addressFields.phone),
        province: addressFields.province,
        city: addressFields.city,
        addressLine: addressFields.addressLine.trim(),
        postalCode: digitsOnly(addressFields.postalCode, 10),
      }),
    });
    if (!response.ok) {
      if (response.status === 401) setAuth({ status: 'anonymous', expired: true });
      setCheckoutError((await readError(response)).message);
      return null;
    }
    const payload: unknown = await response.json();
    if (!isUserAddress(payload)) {
      setCheckoutError('آدرس ذخیره شد اما پاسخ سرویس معتبر نبود. صفحه را دوباره بارگذاری کنید.');
      return null;
    }
    setAddresses((current) => [payload, ...current]);
    setSelectedAddressId(payload.id);
    return payload;
  }

  async function submitCheckout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      auth.status !== 'authenticated' ||
      items.length === 0 ||
      checkoutLoading ||
      uncertainCheckout ||
      staleCart
    )
      return;
    setCheckoutLoading(true);
    setCheckoutError(null);

    let phase: 'order' | 'payment' = 'order';
    try {
      let orderId = pendingOrderId;
      let orderNumber = completedOrderNumber;
      if (!orderId) {
        let userAddressId = selectedAddress?.id;
        if (!userAddressId && saveAddress) {
          if (!addressFields.title.trim()) {
            setCheckoutError('برای ذخیره آدرس، یک عنوان مانند خانه یا محل کار وارد کنید.');
            return;
          }
          userAddressId = (await saveNewAddress())?.id;
          if (!userAddressId) return;
        }

        const orderBody = userAddressId
          ? buildCreateOrderBody(items, { userAddressId })
          : buildCreateOrderBody(items, {
              shippingAddress: {
                recipientName: addressFields.recipientName.trim(),
                phone: toAsciiDigits(addressFields.phone),
                province: addressFields.province,
                city: addressFields.city,
                addressLine: addressFields.addressLine.trim(),
                postalCode: digitsOnly(addressFields.postalCode, 10),
              },
            });
        const orderResponse = await fetch('/api/checkout/order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(orderBody),
        });
        if (!orderResponse.ok) {
          if (orderResponse.status === 401) setAuth({ status: 'anonymous', expired: true });
          const orderError = await readError(orderResponse);
          if (
            orderResponse.status === 404 ||
            (orderResponse.status === 409 &&
              ['INVENTORY_NOT_AVAILABLE', 'INVENTORY_STATE_CHANGED'].includes(
                orderError.code ?? '',
              ))
          ) {
            setStaleCart(true);
            setCheckoutError(
              'محصول، موجودی یا آدرس ذخیره‌شده دیگر در دسترس نیست. سبد و آدرس را بررسی و اصلاح کنید.',
            );
            return;
          }
          if (orderResponse.status >= 500) setUncertainCheckout('order');
          setCheckoutError(orderError.message);
          return;
        }
        const order = (await orderResponse.json()) as CustomerOrderDetail;
        if (!Number.isSafeInteger(order.grandTotalToman) || order.grandTotalToman < 0) {
          setCheckoutError('مبلغ نهایی معتبری از سرویس سفارش دریافت نشد. دوباره تلاش کنید.');
          return;
        }
        orderId = order.id;
        orderNumber = order.orderNumber;
        setPendingOrderId(order.id);
        setPendingOrderTotalToman(order.grandTotalToman);
        setCompletedOrderNumber(order.orderNumber);
        if (order.grandTotalToman !== subtotalToman) {
          setPriceChange({
            cartSubtotalToman: subtotalToman,
            orderTotalToman: order.grandTotalToman,
          });
          return;
        }
      }

      setPriceChange(null);
      phase = 'payment';
      paymentIdempotencyKey.current ??= crypto.randomUUID();
      const paymentResponse = await fetch('/api/checkout/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, idempotencyKey: paymentIdempotencyKey.current }),
      });
      if (!paymentResponse.ok) {
        if (paymentResponse.status === 401) setAuth({ status: 'anonymous', expired: true });
        if (paymentResponse.status >= 500 || paymentResponse.status === 409)
          setUncertainCheckout('payment');
        setCheckoutError(
          paymentResponse.status >= 500 || paymentResponse.status === 409
            ? 'وضعیت آغاز پرداخت مشخص نیست. پیش از هر اقدام دوباره، سفارش را در حساب کاربری بررسی کنید.'
            : `${(await readError(paymentResponse)).message} سفارش ${toPersianDigits(orderNumber ?? '')} ثبت شده است.`,
        );
        return;
      }
      const payment = (await paymentResponse.json()) as PaymentInitiationResponse;
      if (payment.alreadyPaid) {
        clearCart();
        setPendingOrderId(null);
        setPendingOrderTotalToman(null);
        setCompletedOrderNumber(orderNumber);
        return;
      }
      let gatewayUrl: URL;
      try {
        gatewayUrl = new URL(payment.paymentUrl ?? '');
        const localHttpGateway =
          process.env.NODE_ENV !== 'production' &&
          gatewayUrl.protocol === 'http:' &&
          ['localhost', '127.0.0.1'].includes(gatewayUrl.hostname);
        if (gatewayUrl.protocol !== 'https:' && !localHttpGateway) {
          throw new Error('Invalid gateway protocol');
        }
      } catch {
        setUncertainCheckout('payment');
        setCheckoutError('آدرس درگاه معتبر نیست. پیش از تلاش دوباره وضعیت سفارش را بررسی کنید.');
        return;
      }
      window.location.assign(gatewayUrl.toString());
      clearCart();
      setPendingOrderId(null);
      setPendingOrderTotalToman(null);
    } catch {
      setUncertainCheckout(phase);
      setCheckoutError(
        phase === 'payment'
          ? 'وضعیت آغاز پرداخت مشخص نیست. پرداخت را تکرار نکنید؛ ابتدا سفارش را در حساب کاربری بررسی کنید.'
          : 'پاسخ ثبت سفارش دریافت نشد. پیش از تلاش دوباره، سفارش‌های خود را در حساب کاربری بررسی کنید.',
      );
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
          description={`شماره سفارش ${toPersianDigits(completedOrderNumber)} ثبت شده است.`}
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
      <div className="py-10">
        <EmptyState
          title={auth.expired ? 'نشست شما منقضی شده است' : 'برای ادامه خرید وارد شوید'}
          description="از بخش حساب کاربری دوباره وارد شوید و سپس به صفحه پرداخت برگردید."
          action={<Button onClick={openAuthModal}>ورود یا ثبت‌نام</Button>}
        />
      </div>
    );
  }
  if (auth.status === 'unavailable' || auth.status === 'forbidden') {
    return (
      <div className="py-10">
        <EmptyState
          title={
            auth.status === 'forbidden' ? 'دسترسی به پرداخت مجاز نیست' : 'اتصال به سرویس برقرار نشد'
          }
          description={
            auth.status === 'forbidden'
              ? 'برای بررسی دسترسی حساب خود با پشتیبانی تماس بگیرید.'
              : 'سبد شما حفظ شده است. بعد از برقراری ارتباط صفحه را دوباره باز کنید.'
          }
          action={<ButtonLink href="/cart">بازگشت به سبد خرید</ButtonLink>}
        />
      </div>
    );
  }

  const addressOptions = [
    ...addresses.map((address) => ({
      value: address.id,
      label: `${address.title} — ${address.city}`,
    })),
    { value: NEW_ADDRESS_VALUE, label: 'افزودن آدرس جدید' },
  ];
  const payableAmount = pendingOrderTotalToman ?? subtotalToman;

  return (
    <form
      className="grid gap-10 pb-40 pt-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:pb-10"
      onSubmit={submitCheckout}
    >
      <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-medium">اطلاعات ارسال</h2>
            <p className="mt-2 text-sm text-[var(--sf-color-muted)]">
              ورود با {toPersianDigits(auth.user.phone)}
            </p>
          </div>
          {pendingOrderId ? (
            <p className="text-xs text-[var(--sf-color-muted)]">
              سفارش {toPersianDigits(completedOrderNumber ?? '')} ثبت شده؛ پرداخت را دوباره تلاش
              کنید.
            </p>
          ) : null}
        </div>

        <div className="mt-7">
          <FormField id="savedAddress" label="آدرس‌های ذخیره‌شده">
            {(controlProps) => (
              <Select
                {...controlProps}
                value={selectedAddressId}
                options={addressOptions}
                disabled={addressesLoading || Boolean(pendingOrderId)}
                placeholder={addressesLoading ? 'در حال دریافت آدرس‌ها…' : 'انتخاب آدرس'}
                onValueChange={selectAddress}
              />
            )}
          </FormField>
          {addressError ? (
            <p role="alert" className="mt-2 text-xs leading-5 text-red-600">
              {addressError}
            </p>
          ) : null}
        </div>

        {selectedAddress ? (
          <article className="mt-5 rounded-[var(--sf-radius-md)] border border-[var(--sf-color-border)] bg-[var(--sf-color-surface)] p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-bold">{selectedAddress.title}</h3>
              {selectedAddress.isDefault ? (
                <span className="text-xs text-[var(--sf-color-muted)]">آدرس پیش‌فرض</span>
              ) : null}
            </div>
            <p className="mt-3 text-sm leading-7">
              {selectedAddress.province}، {selectedAddress.city}،{' '}
              {toPersianDigits(selectedAddress.addressLine)}
            </p>
            <dl className="mt-3 grid gap-2 text-xs text-[var(--sf-color-muted)] sm:grid-cols-3">
              <div>
                <dt className="inline">گیرنده: </dt>
                <dd className="inline text-[var(--sf-color-ink)]">
                  {selectedAddress.recipientName}
                </dd>
              </div>
              <div>
                <dt className="inline">تلفن: </dt>
                <dd dir="ltr" className="inline text-[var(--sf-color-ink)]">
                  {toPersianDigits(selectedAddress.phone)}
                </dd>
              </div>
              <div>
                <dt className="inline">کد پستی: </dt>
                <dd className="inline text-[var(--sf-color-ink)]">
                  {toPersianDigits(selectedAddress.postalCode)}
                </dd>
              </div>
            </dl>
          </article>
        ) : (
          <div className="mt-7 grid gap-5 sm:grid-cols-2">
            <FormField id="recipientName" label="نام گیرنده" required>
              {(props) => (
                <Input
                  {...props}
                  value={addressFields.recipientName}
                  placeholder="مثلاً علی محمدی"
                  autoComplete="name"
                  required
                  onChange={(event) =>
                    updateField('recipientName', toPersianDigits(event.target.value))
                  }
                />
              )}
            </FormField>
            <FormField id="shippingPhone" label="شماره تماس گیرنده" required>
              {(props) => (
                <Input
                  {...props}
                  dir="ltr"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={addressFields.phone}
                  placeholder="۰۹۱۲ ۳۴۵ ۶۷۸۹"
                  required
                  onChange={(event) =>
                    updateField('phone', toPersianDigits(toAsciiDigits(event.target.value)))
                  }
                />
              )}
            </FormField>
            <FormField id="province" label="استان" required>
              {(props) => (
                <Select
                  {...props}
                  name="province"
                  value={addressFields.province}
                  options={provinceOptions}
                  placeholder="استان را انتخاب کنید"
                  required
                  onValueChange={(province) => {
                    updateField('province', province);
                    updateField('city', '');
                  }}
                />
              )}
            </FormField>
            <FormField id="city" label="شهر" required>
              {(props) => (
                <Select
                  {...props}
                  name="city"
                  value={addressFields.city}
                  options={cityOptions}
                  placeholder={
                    addressFields.province ? 'شهر را انتخاب کنید' : 'ابتدا استان را انتخاب کنید'
                  }
                  disabled={!addressFields.province}
                  required
                  onValueChange={(city) => updateField('city', city)}
                />
              )}
            </FormField>
            <FormField id="postalCode" label="کد پستی ۱۰ رقمی" required className="sm:col-span-2">
              {(props) => (
                <Input
                  {...props}
                  dir="rtl"
                  inputMode="numeric"
                  autoComplete="postal-code"
                  value={addressFields.postalCode}
                  placeholder="۱۲۳۴۵۶۷۸۹۰"
                  maxLength={10}
                  pattern="[۰-۹0-9]{10}"
                  required
                  onChange={(event) =>
                    updateField('postalCode', toPersianDigits(digitsOnly(event.target.value, 10)))
                  }
                />
              )}
            </FormField>
            <FormField id="addressLine" label="نشانی کامل" required className="sm:col-span-2">
              {(props) => (
                <Textarea
                  {...props}
                  value={addressFields.addressLine}
                  placeholder="خیابان، کوچه، پلاک، واحد و جزئیات لازم برای تحویل"
                  autoComplete="street-address"
                  required
                  onChange={(event) =>
                    updateField('addressLine', toPersianDigits(event.target.value))
                  }
                />
              )}
            </FormField>
            <div className="sm:col-span-2">
              <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={saveAddress}
                  onChange={(event) => setSaveAddress(event.target.checked)}
                  className="size-4 accent-[var(--sf-color-ink)]"
                />
                این آدرس در حساب کاربری من ذخیره شود
              </label>
            </div>
            {saveAddress ? (
              <FormField
                id="addressTitle"
                label="عنوان آدرس"
                hint="برای نمونه: خانه، محل کار یا منزل والدین"
                required
                className="sm:col-span-2"
              >
                {(props) => (
                  <Input
                    {...props}
                    value={addressFields.title}
                    placeholder="مثلاً خانه"
                    maxLength={100}
                    required
                    onChange={(event) => updateField('title', toPersianDigits(event.target.value))}
                  />
                )}
              </FormField>
            ) : null}
          </div>
        )}
      </section>

      <aside className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--sf-color-border)] bg-[var(--sf-color-canvas)] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-12px_36px_rgb(17_17_17/0.1)] lg:sticky lg:inset-auto lg:top-20 lg:z-auto lg:h-fit lg:border lg:p-5 lg:shadow-none">
        <h2 className="hidden text-lg font-medium lg:block">خلاصه پرداخت</h2>
        <div className="mt-5 hidden items-center justify-between gap-4 text-sm lg:flex">
          <span className="text-[var(--sf-color-muted)]">تعداد کالا</span>
          <span>{new Intl.NumberFormat('fa-IR').format(itemCount)}</span>
        </div>
        {priceChange ? (
          <div className="mb-3 lg:mb-0">
            <div className="hidden items-center justify-between gap-4 text-sm text-[var(--sf-color-muted)] lg:mt-3 lg:flex">
              <span>مبلغ قبلی سبد</span>
              <span className="line-through">
                {formatTomanPrice(priceChange.cartSubtotalToman)}
              </span>
            </div>
            <p
              role="alert"
              className="border border-[var(--sf-color-border)] bg-[var(--sf-color-surface)] p-2 text-xs leading-5 lg:mt-4 lg:p-3 lg:leading-6"
            >
              مبلغ سفارش تغییر کرده است؛ مبلغ جدید را بررسی و تأیید کنید.
            </p>
          </div>
        ) : null}
        <div className="flex items-center gap-4 lg:mt-3 lg:block">
          <div className="min-w-0 flex-1 lg:flex lg:items-center lg:justify-between lg:gap-4">
            <span className="block text-xs text-[var(--sf-color-muted)] lg:text-sm">
              مبلغ قابل پرداخت
            </span>
            <strong className="mt-1 block whitespace-nowrap text-lg font-bold lg:mt-0 lg:text-xl">
              {formatTomanPrice(priceChange?.orderTotalToman ?? payableAmount)}
            </strong>
          </div>
          {uncertainCheckout || staleCart ? (
            <ButtonLink
              href={
                staleCart
                  ? '/cart'
                  : pendingOrderId
                    ? `/account/orders/${pendingOrderId}`
                    : '/account/orders'
              }
              className="shrink-0 px-5 lg:mt-6 lg:w-full"
            >
              {staleCart ? 'بازبینی و اصلاح سبد خرید' : 'بررسی وضعیت سفارش'}
            </ButtonLink>
          ) : (
            <Button
              type="submit"
              loading={checkoutLoading}
              className="shrink-0 px-5 lg:mt-6 lg:w-full"
            >
              {priceChange
                ? 'تأیید مبلغ جدید و پرداخت'
                : pendingOrderId
                  ? 'تلاش مجدد برای پرداخت'
                  : 'ثبت سفارش و پرداخت'}
            </Button>
          )}
        </div>
        {checkoutError ? (
          <p role="alert" className="mt-3 text-xs leading-5 text-red-600 lg:mt-5 lg:leading-6">
            {checkoutError}
          </p>
        ) : null}
        <div className="hidden lg:block">
          <ButtonLink href="/cart" variant="text" className="mt-3 w-full">
            بازگشت به سبد خرید
          </ButtonLink>
        </div>
      </aside>
    </form>
  );
}
