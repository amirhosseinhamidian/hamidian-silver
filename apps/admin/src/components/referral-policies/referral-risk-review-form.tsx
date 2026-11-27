'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/form-control';
import { FormField } from '@/components/ui/form-field';
import { referralPolicyResponse } from '@/lib/reward-policies/referral-reward-policy';
import { actionLabels, type RiskCase } from '@/lib/reward-policies/referral-risk';

export function ReferralRiskReviewForm({
  caseId,
  revision,
}: Readonly<{ caseId: string; revision: number }>) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || saved) return;
    const data = new FormData(event.currentTarget);
    const action = data.get('action');
    const reason = String(data.get('reason') ?? '').trim();
    if (reason.length < 3) {
      setError('دلیل تصمیم را وارد کنید.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/referral-risk/review-${caseId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expectedRevision: revision, action, reason }),
      });
      await referralPolicyResponse<RiskCase>(response);
      setSaved(true);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'ثبت تصمیم انجام نشد.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="max-w-xl space-y-3">
      <fieldset disabled={busy || saved} className="space-y-3">
        <FormField id="risk-review-action" label="تصمیم بررسی" required>
          {(props) => (
            <select
              {...props}
              name="action"
              defaultValue=""
              required
              className="min-h-10 w-full rounded border border-[var(--admin-color-border)] bg-[var(--admin-color-surface)] px-3 text-sm"
            >
              <option value="" disabled>
                انتخاب تصمیم
              </option>
              {(['ALLOW', 'HOLD', 'REJECT'] as const).map((action) => (
                <option key={action} value={action}>
                  {actionLabels[action]}
                </option>
              ))}
            </select>
          )}
        </FormField>
        <FormField id="risk-review-reason" label="دلیل تصمیم برای حسابرسی" required>
          {(props) => <Textarea {...props} name="reason" required maxLength={250} minLength={3} />}
        </FormField>
        <Button type="submit" loading={busy}>
          ثبت تصمیم
        </Button>
      </fieldset>
      {saved && <Alert tone="success">تصمیم ثبت شد.</Alert>}
      {error && <Alert tone="danger">{error}</Alert>}
    </form>
  );
}
