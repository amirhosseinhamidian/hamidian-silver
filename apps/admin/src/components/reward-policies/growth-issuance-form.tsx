'use client';

import { useState, type FormEvent } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button, ButtonLink } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Select } from '@/components/ui/select';
import { formatAdminDateTime } from '@/lib/presentation/formatters';
import {
  issuanceLabels,
  readIssuanceState,
  type IssuanceMode,
  type IssuanceState,
} from '@/lib/reward-policies/growth-rollout';

export function GrowthIssuanceForm({
  initial,
  canWrite,
}: {
  initial: IssuanceState;
  canWrite: boolean;
}) {
  const [state, setState] = useState(initial);
  const [selected, setSelected] = useState(initial.mode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [stale, setStale] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWrite || busy || stale || state.mode === selected) return;
    setBusy(true);
    setError('');
    setSaved(false);
    try {
      const response = await fetch('/api/reward-policies/credit-issuance', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: selected, expectedVersion: state.version }),
      });
      if (response.status === 409) {
        setStale(true);
        setError('مدیر دیگری وضعیت صدور را به‌روز کرده است. وضعیت فعلی را بارگیری کنید.');
        return;
      }
      if (response.status === 401 || response.status === 403) {
        setError('برای تغییر وضعیت، نشست فعال و مجوز تغییر مالی لازم است.');
        return;
      }
      const next = response.ok ? readIssuanceState(await response.json()) : null;
      if (!next) throw new Error('Could not read credit issuance state.');
      setState(next);
      setSelected(next.mode);
      setSaved(true);
    } catch {
      setError('نتیجهٔ ذخیره مشخص نیست. وضعیت فعلی را بارگیری کنید.');
      setStale(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="space-y-3" onSubmit={submit}>
      <p className="text-sm">
        وضعیت فعلی <strong>{issuanceLabels[state.mode]}</strong> ·{' '}
        {formatAdminDateTime(state.changedAt)}
      </p>
      {canWrite && (
        <div className="space-y-3">
          <FormField
            id="growth-issuance-mode"
            label="وضعیت بعدی صدور خودکار"
            hint="در حالت فعال، پردازش کارهای منتظر طبق سیاست ثبت‌شده ادامه پیدا می‌کند."
          >
            {(props) => (
              <Select
                {...props}
                value={selected}
                onValueChange={(mode) => setSelected(mode as IssuanceMode)}
                disabled={busy || stale}
                options={Object.entries(issuanceLabels).map(([value, label]) => ({ value, label }))}
              />
            )}
          </FormField>
          <Button type="submit" loading={busy} disabled={stale || selected === state.mode}>
            ثبت وضعیت صدور
          </Button>
          {error && (
            <Alert
              tone="danger"
              action={
                stale ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => window.location.reload()}
                  >
                    بارگیری وضعیت
                  </Button>
                ) : undefined
              }
            >
              {error}
            </Alert>
          )}
          {saved && !error && <Alert tone="success">وضعیت صدور ثبت شد.</Alert>}
        </div>
      )}
      {state.mode !== 'LIVE' && (
        <ButtonLink href="/reward-policies/simulator" size="sm" variant="outline">
          بررسی سیاست در شبیه‌ساز
        </ButtonLink>
      )}
    </form>
  );
}
