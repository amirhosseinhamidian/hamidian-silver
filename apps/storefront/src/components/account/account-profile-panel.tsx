'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import type { CustomerProfile } from '@/components/account/account-types';
import { readResponseError, toPersianDigits } from '@/components/account/account-types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form-control';
import { FormField } from '@/components/ui/form-field';

type AccountProfilePanelProps = Readonly<{
  profile: CustomerProfile;
  onProfileChange: (profile: CustomerProfile) => void;
}>;

export function AccountProfilePanel({ profile, onProfileChange }: AccountProfilePanelProps) {
  const router = useRouter();
  const [firstName, setFirstName] = useState(toPersianDigits(profile.firstName ?? ''));
  const [lastName, setLastName] = useState(toPersianDigits(profile.lastName ?? ''));
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logoutLoading, setLogoutLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName: firstName.trim(), lastName: lastName.trim() }),
      });
      if (!response.ok) {
        setError(await readResponseError(response));
        return;
      }

      const updated = (await response.json()) as CustomerProfile;
      onProfileChange(updated);
      setMessage('اطلاعات حساب با موفقیت ذخیره شد.');
    } catch {
      setError('ارتباط با سرویس حساب برقرار نشد.');
    } finally {
      setSubmitting(false);
    }
  }

  async function logout() {
    if (logoutLoading) return;
    setLogoutLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      if (!response.ok) {
        setError(await readResponseError(response));
        return;
      }
      router.push('/');
      router.refresh();
    } catch {
      setError('خروج از حساب انجام نشد. دوباره تلاش کنید.');
    } finally {
      setLogoutLoading(false);
    }
  }

  return (
    <section aria-labelledby="account-profile-heading">
      <div className="border-b border-[var(--sf-color-border)] pb-5">
        <h2 id="account-profile-heading" className="text-2xl font-medium">
          اطلاعات حساب
        </h2>
        <p className="mt-2 text-sm leading-7 text-[var(--sf-color-muted)]">
          نام شما در سفارش‌ها و ارتباطات فروشگاه استفاده می‌شود.
        </p>
      </div>

      <form onSubmit={submit} className="grid gap-5 pt-6 sm:max-w-2xl sm:grid-cols-2">
        <FormField id="account-first-name" label="نام" required>
          {(props) => (
            <Input
              {...props}
              value={firstName}
              onChange={(event) => setFirstName(toPersianDigits(event.target.value))}
              minLength={1}
              maxLength={100}
              autoComplete="given-name"
              placeholder="مثلاً امیرحسین"
              required
            />
          )}
        </FormField>
        <FormField id="account-last-name" label="نام خانوادگی" required>
          {(props) => (
            <Input
              {...props}
              value={lastName}
              onChange={(event) => setLastName(toPersianDigits(event.target.value))}
              minLength={1}
              maxLength={100}
              autoComplete="family-name"
              placeholder="مثلاً حمیدیان"
              required
            />
          )}
        </FormField>
        <FormField
          id="account-phone"
          label="شماره همراه"
          hint="شماره همراه تأییدشده قابل ویرایش نیست."
          className="sm:col-span-2"
        >
          {(props) => (
            <Input
              {...props}
              value={toPersianDigits(profile.phone)}
              placeholder="۰۹۱۲۳۴۵۶۷۸۹"
              dir="ltr"
              readOnly
              disabled
            />
          )}
        </FormField>

        {error ? (
          <p role="alert" className="text-sm text-red-700 sm:col-span-2">
            {error}
          </p>
        ) : null}
        {message ? (
          <p role="status" className="text-sm text-[var(--sf-color-muted)] sm:col-span-2">
            {message}
          </p>
        ) : null}

        <div className="sm:col-span-2">
          <Button type="submit" loading={submitting}>
            ذخیره تغییرات
          </Button>
        </div>
      </form>

      <div className="mt-10 border-t border-[var(--sf-color-border)] pt-6">
        <h3 className="text-lg font-medium">خروج از حساب</h3>
        <p className="mt-2 text-sm leading-7 text-[var(--sf-color-muted)]">
          با خروج، برای مشاهده دوباره اطلاعات حساب باید وارد شوید.
        </p>
        <Button
          type="button"
          variant="outline"
          loading={logoutLoading}
          onClick={() => void logout()}
          className="mt-4"
        >
          خروج از حساب کاربری
        </Button>
      </div>
    </section>
  );
}
