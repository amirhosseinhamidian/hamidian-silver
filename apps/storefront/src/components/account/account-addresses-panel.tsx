'use client';

import { useMemo, useState, type FormEvent } from 'react';

import type { CustomerAddress } from '@/components/account/account-types';
import { readResponseError, toPersianDigits } from '@/components/account/account-types';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/form-control';
import { FormField } from '@/components/ui/form-field';
import { Select } from '@/components/ui/select';
import { cityOptionsFor, PROVINCE_OPTIONS } from '@/lib/checkout/iran-locations';
import { cn } from '@/lib/ui/cn';

type AddressDraft = Omit<CustomerAddress, 'id' | 'isDefault' | 'createdAt' | 'updatedAt'>;

const EMPTY_ADDRESS: AddressDraft = {
  title: '',
  recipientName: '',
  phone: '',
  province: '',
  city: '',
  addressLine: '',
  postalCode: '',
};

function asciiDigits(value: string): string {
  return value
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/\D/g, '');
}

type AccountAddressesPanelProps = Readonly<{
  addresses: CustomerAddress[];
  profilePhone: string;
  reloadAddresses: () => Promise<void>;
}>;

export function AccountAddressesPanel({
  addresses,
  profilePhone,
  reloadAddresses,
}: AccountAddressesPanelProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState<AddressDraft>({
    ...EMPTY_ADDRESS,
    phone: toPersianDigits(profilePhone),
  });
  const [submitting, setSubmitting] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cityOptions = useMemo(() => cityOptionsFor(draft.province), [draft.province]);

  function update<Key extends keyof AddressDraft>(key: Key, value: AddressDraft[Key]) {
    setDraft((current) => ({ ...current, [key]: toPersianDigits(value) }));
  }

  function startCreate() {
    setEditingId(null);
    setDraft({ ...EMPTY_ADDRESS, phone: toPersianDigits(profilePhone) });
    setError(null);
    setShowForm(true);
  }

  function startEdit(address: CustomerAddress) {
    setEditingId(address.id);
    setDraft({
      title: toPersianDigits(address.title),
      recipientName: toPersianDigits(address.recipientName),
      phone: toPersianDigits(address.phone),
      province: toPersianDigits(address.province),
      city: toPersianDigits(address.city),
      addressLine: toPersianDigits(address.addressLine),
      postalCode: toPersianDigits(address.postalCode),
    });
    setError(null);
    setShowForm(true);
  }

  async function mutate(url: string, init: RequestInit) {
    const response = await fetch(url, init);
    if (!response.ok) throw new Error(await readResponseError(response));
    await reloadAddresses();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      await mutate(editingId ? `/api/profile/addresses/${editingId}` : '/api/profile/addresses', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...draft,
          phone: asciiDigits(draft.phone),
          postalCode: asciiDigits(draft.postalCode),
        }),
      });
      setShowForm(false);
      setEditingId(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'ذخیره آدرس انجام نشد.');
    } finally {
      setSubmitting(false);
    }
  }

  async function setDefault(addressId: string) {
    setPendingId(addressId);
    setError(null);
    try {
      await mutate(`/api/profile/addresses/${addressId}/default`, { method: 'PATCH' });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'تغییر آدرس پیش‌فرض انجام نشد.');
    } finally {
      setPendingId(null);
    }
  }

  async function remove(addressId: string) {
    if (!window.confirm('این آدرس حذف شود؟')) return;
    setPendingId(addressId);
    setError(null);
    try {
      await mutate(`/api/profile/addresses/${addressId}`, { method: 'DELETE' });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'حذف آدرس انجام نشد.');
    } finally {
      setPendingId(null);
    }
  }

  return (
    <section aria-labelledby="account-addresses-heading">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--sf-color-border)] pb-5">
        <div>
          <h2 id="account-addresses-heading" className="text-2xl font-medium">
            آدرس‌ها
          </h2>
          <p className="mt-2 text-sm leading-7 text-[var(--sf-color-muted)]">
            آدرس‌های تحویل سفارش را مدیریت کنید.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={startCreate}>
          افزودن آدرس جدید
        </Button>
      </div>

      {error ? (
        <p role="alert" className="mt-5 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div
        data-testid="address-form-transition"
        aria-hidden={!showForm}
        inert={!showForm ? true : undefined}
        className={cn(
          'grid transition-[grid-template-rows,opacity,margin] duration-300 ease-out motion-reduce:transition-none',
          showForm
            ? 'mt-6 grid-rows-[1fr] opacity-100'
            : 'pointer-events-none mt-0 grid-rows-[0fr] opacity-0',
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <form
            onSubmit={submit}
            className="grid gap-5 border border-[var(--sf-color-border)] p-5 sm:grid-cols-2"
          >
            <FormField id="address-title" label="عنوان آدرس" required>
              {(props) => (
                <Input
                  {...props}
                  value={draft.title}
                  onChange={(event) => update('title', event.target.value)}
                  placeholder="مثلاً خانه یا محل کار"
                  required
                />
              )}
            </FormField>
            <FormField id="address-recipient" label="نام تحویل‌گیرنده" required>
              {(props) => (
                <Input
                  {...props}
                  value={draft.recipientName}
                  onChange={(event) => update('recipientName', event.target.value)}
                  placeholder="نام و نام خانوادگی تحویل‌گیرنده"
                  required
                />
              )}
            </FormField>
            <FormField id="address-phone" label="شماره همراه" required>
              {(props) => (
                <Input
                  {...props}
                  value={draft.phone}
                  onChange={(event) => update('phone', event.target.value)}
                  placeholder="۰۹۱۲۳۴۵۶۷۸۹"
                  inputMode="tel"
                  dir="ltr"
                  required
                />
              )}
            </FormField>
            <FormField id="address-postal-code" label="کد پستی" required>
              {(props) => (
                <Input
                  {...props}
                  value={draft.postalCode}
                  onChange={(event) => update('postalCode', event.target.value)}
                  placeholder="کد پستی ۱۰ رقمی"
                  inputMode="numeric"
                  dir="ltr"
                  pattern="[0-9۰-۹]{10}"
                  required
                />
              )}
            </FormField>
            <FormField id="address-province" label="استان" required>
              {(props) => (
                <Select
                  {...props}
                  value={draft.province}
                  onValueChange={(value) =>
                    setDraft((current) => ({ ...current, province: value, city: '' }))
                  }
                  options={PROVINCE_OPTIONS}
                  placeholder="استان را انتخاب کنید"
                  required
                />
              )}
            </FormField>
            <FormField id="address-city" label="شهر" required>
              {(props) => (
                <Select
                  {...props}
                  value={draft.city}
                  onValueChange={(value) => update('city', value)}
                  options={cityOptions}
                  placeholder="شهر را انتخاب کنید"
                  disabled={!draft.province}
                  required
                />
              )}
            </FormField>
            <FormField id="address-line" label="نشانی کامل" required className="sm:col-span-2">
              {(props) => (
                <Textarea
                  {...props}
                  value={draft.addressLine}
                  onChange={(event) => update('addressLine', event.target.value)}
                  placeholder="خیابان، کوچه، پلاک، واحد و توضیحات لازم برای تحویل"
                  required
                />
              )}
            </FormField>
            <div className="flex flex-wrap gap-3 sm:col-span-2">
              <Button type="submit" loading={submitting}>
                ذخیره آدرس
              </Button>
              <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
                انصراف
              </Button>
            </div>
          </form>
        </div>
      </div>

      {addresses.length === 0 && !showForm ? (
        <p className="py-14 text-center text-sm text-[var(--sf-color-muted)]">
          هنوز آدرسی ذخیره نکرده‌اید.
        </p>
      ) : (
        <ul className="grid gap-4 pt-6 sm:grid-cols-2">
          {addresses.map((address) => (
            <li key={address.id} className="border border-[var(--sf-color-border)] p-5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-medium">{toPersianDigits(address.title)}</h3>
                {address.isDefault ? (
                  <span className="bg-[var(--sf-color-ink)] px-2 py-1 text-xs text-white">
                    پیش‌فرض
                  </span>
                ) : null}
              </div>
              <p className="mt-4 text-sm font-medium">{toPersianDigits(address.recipientName)}</p>
              <p className="mt-2 text-sm leading-7 text-[var(--sf-color-muted)]">
                {toPersianDigits(address.province)}، {toPersianDigits(address.city)}،{' '}
                {toPersianDigits(address.addressLine)}
              </p>
              <p className="mt-2 text-xs text-[var(--sf-color-subtle)]" dir="ltr">
                {toPersianDigits(address.phone)} · {toPersianDigits(address.postalCode)}
              </p>
              <div className="mt-5 flex flex-wrap gap-2 border-t border-[var(--sf-color-border)] pt-4">
                <Button type="button" size="sm" variant="text" onClick={() => startEdit(address)}>
                  ویرایش
                </Button>
                {!address.isDefault ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="text"
                    loading={pendingId === address.id}
                    onClick={() => void setDefault(address.id)}
                  >
                    انتخاب به‌عنوان پیش‌فرض
                  </Button>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={pendingId === address.id}
                  onClick={() => void remove(address.id)}
                >
                  حذف
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
