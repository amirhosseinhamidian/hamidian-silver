'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/form-control';
import { FormField } from '@/components/ui/form-field';
import {
  hasCompleteAdminProfile,
  normalizeAdminProfileName,
  type AdminProfileIdentity,
} from '@/lib/profile/admin-profile-model';

type AdminProfileCompletionGateProps = Readonly<{
  profile: AdminProfileIdentity | null;
}>;

type FieldErrors = Readonly<{
  firstName?: string;
  lastName?: string;
}>;

function responseError(payload: unknown): string {
  if (typeof payload === 'object' && payload !== null) {
    const message = (payload as Record<string, unknown>).message;
    if (typeof message === 'string' && message.trim()) return message;
    if (Array.isArray(message)) {
      return message.filter((item) => typeof item === 'string').join('، ');
    }
  }

  return 'ذخیره اطلاعات انجام نشد. دوباره تلاش کنید.';
}

function isSavedProfile(payload: unknown): boolean {
  if (typeof payload !== 'object' || payload === null) return false;
  const profile = payload as Record<string, unknown>;
  return (
    typeof profile.firstName === 'string' &&
    typeof profile.lastName === 'string' &&
    Boolean(normalizeAdminProfileName(profile.firstName)) &&
    Boolean(normalizeAdminProfileName(profile.lastName))
  );
}

export function AdminProfileCompletionGate({ profile }: AdminProfileCompletionGateProps) {
  const router = useRouter();
  const [completed, setCompleted] = useState(() => !profile || hasCompleteAdminProfile(profile));
  const [firstName, setFirstName] = useState(profile?.firstName ?? '');
  const [lastName, setLastName] = useState(profile?.lastName ?? '');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [requestError, setRequestError] = useState('');
  const [pending, setPending] = useState(false);

  if (!profile || completed) return null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const normalizedFirstName = normalizeAdminProfileName(firstName);
    const normalizedLastName = normalizeAdminProfileName(lastName);

    if (!normalizedFirstName || !normalizedLastName) {
      setFieldErrors({
        firstName: normalizedFirstName ? undefined : 'نام را وارد کنید.',
        lastName: normalizedLastName ? undefined : 'نام خانوادگی را وارد کنید.',
      });
      setRequestError('');
      return;
    }

    setPending(true);
    setFieldErrors({});
    setRequestError('');

    try {
      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: normalizedFirstName,
          lastName: normalizedLastName,
        }),
      });
      const payload = (await response.json().catch(() => null)) as unknown;

      if (!response.ok) throw new Error(responseError(payload));
      if (!isSavedProfile(payload)) throw new Error('پاسخ سرویس پروفایل معتبر نیست.');

      setCompleted(true);
      router.refresh();
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : responseError(null));
      setPending(false);
    }
  }

  return (
    <Dialog open>
      <DialogContent
        title="تکمیل اطلاعات مدیر"
        description="برای ادامه کار در پنل، نام و نام خانوادگی خود را ثبت کنید."
        size="sm"
        hideClose
        onEscapeKeyDown={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
      >
        <form className="space-y-5" onSubmit={(event) => void submit(event)} noValidate>
          <Alert tone="info">
            این اطلاعات برای شناسایی عملیات مدیریتی و گزارش‌های قابل حسابرسی استفاده می‌شود.
          </Alert>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              id="admin-profile-first-name"
              label="نام"
              required
              error={fieldErrors.firstName}
            >
              {(controlProps) => (
                <Input
                  {...controlProps}
                  value={firstName}
                  onChange={(event) => {
                    setFirstName(event.target.value);
                    if (fieldErrors.firstName) {
                      setFieldErrors({ ...fieldErrors, firstName: undefined });
                    }
                    if (requestError) setRequestError('');
                  }}
                  autoComplete="given-name"
                  minLength={1}
                  maxLength={100}
                  placeholder="مثلاً امیرحسین"
                  autoFocus
                  disabled={pending}
                />
              )}
            </FormField>

            <FormField
              id="admin-profile-last-name"
              label="نام خانوادگی"
              required
              error={fieldErrors.lastName}
            >
              {(controlProps) => (
                <Input
                  {...controlProps}
                  value={lastName}
                  onChange={(event) => {
                    setLastName(event.target.value);
                    if (fieldErrors.lastName) {
                      setFieldErrors({ ...fieldErrors, lastName: undefined });
                    }
                    if (requestError) setRequestError('');
                  }}
                  autoComplete="family-name"
                  minLength={1}
                  maxLength={100}
                  placeholder="مثلاً حمیدیان"
                  disabled={pending}
                />
              )}
            </FormField>
          </div>

          {requestError ? <Alert tone="danger">{requestError}</Alert> : null}

          <Button type="submit" size="lg" loading={pending} className="w-full">
            ذخیره و ورود به پنل
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
