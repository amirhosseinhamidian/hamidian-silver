'use client';

import { useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/form-control';
import { FormField } from '@/components/ui/form-field';
import { toAsciiDigits } from '@/lib/presentation/formatters';

type Action =
  | {
      kind: 'corrections';
      id: string;
      targetId: string;
      correction: 'REVOKE_GRANT' | 'REVERSE_CAPTURE';
    }
  | { kind: 'review-hold'; id: string; hold: boolean }
  | { kind: 'retry'; id: string };

export function WalletActionForm({
  action,
  label,
  fieldId,
}: Readonly<{
  action: Action;
  label: string;
  fieldId: string;
}>) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<'idle' | 'busy' | 'saved'>('idle');
  const [error, setError] = useState('');
  const key = useRef<{ fingerprint: string; id: string } | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status !== 'idle') return;
    const form = new FormData(event.currentTarget);
    const reason = String(form.get('reason') ?? '').trim();
    const amount = toAsciiDigits(String(form.get('amount') ?? '').trim());
    const amountToman = Number(amount);
    if (action.kind !== 'retry' && reason.length < 3) {
      setError('دلیل را با دست‌کم سه نویسه وارد کنید.');
      return;
    }
    if (
      action.kind === 'corrections' &&
      (!/^\d+$/.test(amount) ||
        !Number.isInteger(amountToman) ||
        amountToman < 1 ||
        amountToman > 2_147_483_647)
    ) {
      setError('مبلغ معتبر را به عدد صحیح تومان وارد کنید.');
      return;
    }
    const fingerprint = JSON.stringify({ action, amountToman, reason });
    if (action.kind === 'corrections' && key.current?.fingerprint !== fingerprint) {
      key.current = { fingerprint, id: crypto.randomUUID() };
    }
    const body =
      action.kind === 'corrections'
        ? {
            kind: action.correction,
            targetId: action.targetId,
            requestId: key.current?.id,
            amountToman,
            reason,
          }
        : action.kind === 'review-hold'
          ? { hold: action.hold, reason }
          : {};
    setStatus('busy');
    setError('');
    try {
      const response = await fetch(`/api/wallet/${action.kind}/${action.id}`, {
        method: action.kind === 'review-hold' ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (response.ok) {
        setStatus('saved');
        router.refresh();
        return;
      }
      setError(
        response.status === 401 || response.status === 403
          ? 'برای ثبت این اقدام به نشست معتبر و مجوز تغییر مالی نیاز دارید.'
          : response.status === 400 || response.status === 409 || response.status === 404
            ? 'این اقدام با وضعیت فعلی قابل ثبت نیست. گزارش و مبلغ را بررسی کنید.'
            : 'نتیجهٔ ثبت مشخص نیست. وضعیت فعلی را بررسی کنید.',
      );
    } catch {
      setError('نتیجهٔ ثبت مشخص نیست. وضعیت فعلی را بررسی کنید.');
    }
    setStatus('idle');
  }

  if (status === 'saved')
    return (
      <p role="status" className="text-sm">
        اقدام ثبت شد.
      </p>
    );
  return (
    <div className="space-y-3">
      <Button
        size="sm"
        variant="outline"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? 'بستن فرم' : label}
      </Button>
      {open && (
        <form
          onSubmit={(event) => void submit(event)}
          aria-label={label}
          className="max-w-md space-y-3"
        >
          <fieldset disabled={status === 'busy'} className="space-y-3">
            {action.kind === 'corrections' && (
              <FormField id={`${fieldId}-amount`} label="مبلغ اصلاح به تومان" required>
                {(props) => (
                  <Input {...props} name="amount" inputMode="numeric" maxLength={10} required />
                )}
              </FormField>
            )}
            {action.kind !== 'retry' && (
              <FormField id={`${fieldId}-reason`} label="دلیل ثبت در حسابرسی" required>
                {(props) => <Textarea {...props} name="reason" maxLength={250} required />}
              </FormField>
            )}
            <Button size="sm" type="submit" loading={status === 'busy'}>
              {label}
            </Button>
          </fieldset>
          {error && <Alert tone="danger">{error}</Alert>}
        </form>
      )}
    </div>
  );
}
