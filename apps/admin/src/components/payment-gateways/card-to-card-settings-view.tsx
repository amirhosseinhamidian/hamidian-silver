'use client';

import { useState, type FormEvent } from 'react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/form-control';
import { FormField } from '@/components/ui/form-field';
import {
  parseCardToCardAccount,
  type AdminCardToCardAccount,
} from '@/lib/payment-gateways/card-to-card-account-model';
import { formatAdminDateTime } from '@/lib/presentation/formatters';

type CardToCardSettingsViewProps = Readonly<{
  initialAccounts: readonly AdminCardToCardAccount[];
  canWrite: boolean;
}>;

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

function asciiDigits(value: string): string {
  return [...value]
    .map((character) => {
      const persianIndex = PERSIAN_DIGITS.indexOf(character);
      if (persianIndex >= 0) return String(persianIndex);
      const arabicIndex = ARABIC_DIGITS.indexOf(character);
      return arabicIndex >= 0 ? String(arabicIndex) : character;
    })
    .join('')
    .replace(/\D/g, '')
    .slice(0, 16);
}

function groupedCardNumber(value: string): string {
  return value.replace(/(\d{4})(?=\d)/g, '$1 ');
}

function responseError(payload: unknown): string {
  if (typeof payload === 'object' && payload !== null) {
    const value = payload as Record<string, unknown>;
    const message = value.message;
    if (typeof message === 'string') return message;
    if (Array.isArray(message)) return message.join('، ');
  }
  return 'ذخیره تنظیمات کارت‌به‌کارت انجام نشد.';
}

export function CardToCardSettingsView({ initialAccounts, canWrite }: CardToCardSettingsViewProps) {
  const [accounts, setAccounts] = useState(initialAccounts);
  const [cardNumber, setCardNumber] = useState('');
  const [holderName, setHolderName] = useState('');
  const [bankName, setBankName] = useState('');
  const [activate, setActivate] = useState(initialAccounts.length === 0);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function addAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || cardNumber.length !== 16 || !holderName.trim() || !bankName.trim()) return;

    setPending('create');
    setError(null);
    setMessage(null);
    try {
      const response = await fetch('/api/card-to-card-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cardNumber,
          holderName: holderName.trim(),
          bankName: bankName.trim(),
          isActive: activate,
        }),
      });
      const payload = (await response.json().catch(() => null)) as unknown;
      if (!response.ok) throw new Error(responseError(payload));
      const created = parseCardToCardAccount(payload);
      if (!created) throw new Error('پاسخ سرویس تنظیمات معتبر نبود.');

      setAccounts((current) => [
        created,
        ...current.map((account) => (created.isActive ? { ...account, isActive: false } : account)),
      ]);
      setCardNumber('');
      setHolderName('');
      setBankName('');
      setActivate(false);
      setMessage('کارت جدید با موفقیت اضافه شد.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : responseError(null));
    } finally {
      setPending(null);
    }
  }

  async function toggleAccount(account: AdminCardToCardAccount) {
    if (pending) return;
    setPending(account.id);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/card-to-card-accounts/${encodeURIComponent(account.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !account.isActive }),
      });
      const payload = (await response.json().catch(() => null)) as unknown;
      if (!response.ok) throw new Error(responseError(payload));
      const updated = parseCardToCardAccount(payload);
      if (!updated) throw new Error('پاسخ سرویس تنظیمات معتبر نبود.');

      setAccounts((current) =>
        current.map((item) =>
          item.id === updated.id ? updated : updated.isActive ? { ...item, isActive: false } : item,
        ),
      );
      setMessage(
        updated.isActive
          ? 'کارت انتخاب‌شده برای پرداخت مشتری فعال شد.'
          : 'پرداخت کارت‌به‌کارت غیرفعال شد.',
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : responseError(null));
    } finally {
      setPending(null);
    }
  }

  async function deleteAccount(account: AdminCardToCardAccount) {
    if (pending || !window.confirm(`کارت ${groupedCardNumber(account.cardNumber)} حذف شود؟`)) {
      return;
    }

    setPending(account.id);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/card-to-card-accounts/${encodeURIComponent(account.id)}`, {
        method: 'DELETE',
      });
      const payload = (await response.json().catch(() => null)) as unknown;
      if (!response.ok) throw new Error(responseError(payload));
      setAccounts((current) => current.filter((item) => item.id !== account.id));
      setMessage('کارت حذف شد.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : responseError(null));
    } finally {
      setPending(null);
    }
  }

  return (
    <section aria-labelledby="card-to-card-settings-heading" className="space-y-4">
      <div>
        <h2 id="card-to-card-settings-heading" className="text-xl font-black">
          کارت‌به‌کارت
        </h2>
        <p className="mt-2 text-sm leading-7 text-[var(--admin-color-muted)]">
          چند کارت می‌توانید ثبت کنید؛ فقط کارت فعال در checkout به مشتری نمایش داده می‌شود.
        </p>
      </div>

      {error ? <Alert tone="danger">{error}</Alert> : null}
      {message ? <Alert tone="success">{message}</Alert> : null}

      {canWrite ? (
        <Card
          title="افزودن کارت"
          description="اطلاعات حساب مقصد را دقیقاً مطابق کارت بانکی ثبت کنید."
        >
          <form className="grid gap-4 lg:grid-cols-3" onSubmit={addAccount}>
            <FormField id="card-number" label="شماره کارت" required>
              {(controlProps) => (
                <Input
                  {...controlProps}
                  dir="ltr"
                  inputMode="numeric"
                  autoComplete="off"
                  value={cardNumber}
                  placeholder="6037991234567890"
                  onChange={(event) => setCardNumber(asciiDigits(event.target.value))}
                />
              )}
            </FormField>
            <FormField id="card-holder-name" label="نام صاحب حساب" required>
              {(controlProps) => (
                <Input
                  {...controlProps}
                  value={holderName}
                  onChange={(event) => setHolderName(event.target.value)}
                />
              )}
            </FormField>
            <FormField id="card-bank-name" label="نام بانک" required>
              {(controlProps) => (
                <Input
                  {...controlProps}
                  value={bankName}
                  onChange={(event) => setBankName(event.target.value)}
                />
              )}
            </FormField>
            <label className="flex min-h-10 items-center gap-3 text-sm lg:col-span-2">
              <input
                type="checkbox"
                checked={activate}
                onChange={(event) => setActivate(event.target.checked)}
                className="size-4 accent-[var(--admin-color-primary)]"
              />
              این کارت پس از ثبت فعال شود
            </label>
            <Button
              type="submit"
              loading={pending === 'create'}
              disabled={cardNumber.length !== 16 || !holderName.trim() || !bankName.trim()}
            >
              افزودن کارت
            </Button>
          </form>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {accounts.map((account) => (
          <Card
            key={account.id}
            title={
              <span className="flex flex-wrap items-center gap-2">
                <span>{account.bankName}</span>
                {account.isActive ? <Badge tone="success">فعال</Badge> : null}
              </span>
            }
            description={account.holderName}
          >
            <p className="font-mono text-xl tracking-[0.08em]" dir="ltr">
              {groupedCardNumber(account.cardNumber)}
            </p>
            <p className="mt-3 text-xs text-[var(--admin-color-muted)]">
              آخرین تغییر: {formatAdminDateTime(account.updatedAt)}
            </p>
            {canWrite ? (
              <div className="mt-5 flex flex-wrap gap-2 border-t border-[var(--admin-color-border)] pt-4">
                <Button
                  variant={account.isActive ? 'outline' : 'primary'}
                  size="sm"
                  loading={pending === account.id}
                  onClick={() => void toggleAccount(account)}
                >
                  {account.isActive ? 'غیرفعال‌کردن' : 'فعال‌کردن'}
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  disabled={pending !== null}
                  onClick={() => void deleteAccount(account)}
                >
                  حذف
                </Button>
              </div>
            ) : null}
          </Card>
        ))}
      </div>

      {accounts.length === 0 ? (
        <Alert tone="info">
          تا زمانی که کارتی ثبت و فعال نشود، کارت‌به‌کارت در checkout نمایش داده نمی‌شود.
        </Alert>
      ) : null}
    </section>
  );
}
