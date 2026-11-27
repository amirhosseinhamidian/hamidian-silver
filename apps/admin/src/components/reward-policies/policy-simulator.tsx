'use client';

import { useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DualCalendarPicker } from '@/components/ui/dual-calendar-picker';
import { FormField } from '@/components/ui/form-field';
import { Select } from '@/components/ui/select';
import { formatCalendarDay, readCalendarValue } from '@/lib/presentation/dual-calendar';
import { readReferralText } from '@/lib/reward-policies/referral-reward-policy';
import {
  asObject,
  parsePolicyResult,
  policyDecisions,
  type Mode,
  type PolicyDecision,
  type PolicyBasketResult,
  type PolicyHistoryResult,
} from '@/lib/reward-policies/policy-simulator';
import {
  BasketScenarioFields,
  parseScenarioCount,
  readBasketScenario,
  ScenarioInput,
} from './policy-simulation-fields';
import { BasketSimulationResult, HistorySimulationResult } from './policy-simulation-result';

function readDate(data: FormData, name: string) {
  const value = readCalendarValue(readReferralText(data, name), 'date');
  if (!value) throw new Error('ابتدا و انتهای بازه را وارد کنید.');
  return formatCalendarDay(value.day, 'gregory');
}

type Result =
  { mode: 'basket'; value: PolicyBasketResult } | { mode: 'history'; value: PolicyHistoryResult };

export function PolicySimulator({
  activeVersion,
  versions,
  canWrite,
}: {
  activeVersion: number | null;
  versions: readonly number[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('basket');
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const request = useRef<{ key: string; id: string } | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError('');
    const data = new FormData(event.currentTarget);
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const save = canWrite && submitter?.getAttribute('value') === 'review';
    let payload: Record<string, unknown>;
    try {
      const version = parseScenarioCount(readReferralText(data, 'version'), 'نسخهٔ سیاست پاداش');
      if (!version) throw new Error('شمارهٔ نسخهٔ سیاست باید مثبت باشد.');
      payload = {
        version,
        ...(mode === 'basket'
          ? readBasketScenario(data)
          : {
              from: readDate(data, 'from'),
              to: readDate(data, 'to'),
              pendingOnly: data.has('pendingOnly'),
            }),
      };
      if (save) {
        const decision = readReferralText(data, 'decision') as PolicyDecision;
        if (!Object.hasOwn(policyDecisions, decision))
          throw new Error('تصمیم بررسی را انتخاب کنید.');
        const key = JSON.stringify([mode, payload, decision]);
        if (request.current?.key !== key) request.current = { key, id: crypto.randomUUID() };
        payload.review = { requestId: request.current.id, decision };
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'ورودی سناریو معتبر نیست.');
      return;
    }
    setBusy(true);
    try {
      const response = await fetch('/api/reward-policies/policy-simulator/' + mode, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const value: unknown = await response.json();
      if (response.status === 401 || response.status === 403) {
        setError('نشست یا مجوز مالی برای این عملیات کافی نیست.');
        return;
      }
      if (response.status === 409) {
        setError('شناسهٔ بررسی قبلاً برای سناریوی دیگری ثبت شده است.');
        return;
      }
      if (response.status === 400 || response.status === 404) {
        const problem = asObject(value);
        const message = asObject(problem?.error)?.message ?? problem?.message;
        setError(
          typeof message === 'string' && /[\u0600-\u06ff]/.test(message)
            ? message
            : 'نسخهٔ سیاست، بازه، شناسه‌ها و مبالغ نمونه را بررسی کنید.',
        );
        return;
      }
      const parsed = response.ok ? parsePolicyResult(mode, value) : null;
      if (!parsed) throw new Error('Invalid simulation response');
      if ('items' in parsed) setResult({ mode: 'basket', value: parsed });
      else setResult({ mode: 'history', value: parsed });
      if (parsed.reviewId) {
        request.current = null;
        router.refresh();
      }
    } catch {
      setError(
        save
          ? 'نتیجهٔ ثبت مشخص نیست. برای پیگیری، همان سناریو و تصمیم را دوباره ارسال کنید.'
          : 'اجرای شبیه‌سازی انجام نشد. دوباره تلاش کنید.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <Card title="ورودی شبیه‌سازی">
        <form onSubmit={submit} className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField id="policy-simulation-mode" label="نوع شبیه‌سازی">
              {(props) => (
                <Select
                  {...props}
                  value={mode}
                  disabled={busy}
                  onValueChange={(value) => {
                    if (value === 'basket' || value === 'history') {
                      setMode(value);
                      setResult(null);
                      setError('');
                    }
                  }}
                  options={[
                    { value: 'basket', label: 'سبد و مشوق‌های نمونه' },
                    { value: 'history', label: 'مرور تاریخی پاداش خرید' },
                  ]}
                />
              )}
            </FormField>
            <ScenarioInput
              name="version"
              label="نسخهٔ سیاست پاداش خرید"
              defaultValue={activeVersion ?? ''}
              maximum={10}
              list="reward-policy-versions"
            />
            <datalist id="reward-policy-versions">
              {versions.map((version) => (
                <option key={version} value={version} />
              ))}
            </datalist>
          </div>
          {mode === 'basket' ? (
            <BasketScenarioFields />
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <DualCalendarPicker name="from" label="از تاریخ" kind="date" required />
                <DualCalendarPicker name="to" label="تا تاریخ" kind="date" required />
              </div>
              <p className="text-sm text-[var(--admin-color-muted)]">
                تا ۱۰۰ سفارش اولِ بازهٔ حداکثر ۹۲روزه با سقف‌های ثبت‌شدهٔ زمان محاسبه بررسی می‌شوند.
                جمع برآورد مربوط به همین نمونه است.
              </p>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="pendingOnly" />
                برآورد صف سفارش‌های پرداخت‌شده در حالت شبیه‌سازی
              </label>
              <p className="text-sm text-[var(--admin-color-muted)]">
                در بررسی صف، حداکثر ۱۲ سفارش با ماندهٔ فعلی سقف‌ها جداگانه محاسبه می‌شوند.
              </p>
            </>
          )}
          {error && <Alert tone="danger">{error}</Alert>}
          <div className="flex flex-wrap items-end gap-3">
            <Button type="submit" loading={busy}>
              اجرای شبیه‌سازی
            </Button>
            {canWrite && (
              <>
                <FormField id="policy-decision" label="تصمیم بررسی">
                  {(props) => (
                    <Select
                      {...props}
                      name="decision"
                      defaultValue="HOLD"
                      options={Object.entries(policyDecisions).map(([value, label]) => ({
                        value,
                        label,
                      }))}
                    />
                  )}
                </FormField>
                <Button type="submit" value="review" disabled={busy} variant="outline">
                  اجرا و ثبت تصمیم
                </Button>
              </>
            )}
          </div>
        </form>
      </Card>
      {result && (
        <div className="space-y-4" aria-label="نتیجهٔ آخرین شبیه‌سازی">
          {result.value.reviewId && (
            <Alert tone="success">
              نتیجه و تصمیم بررسی ثبت شد. <bdi className="break-all">{result.value.reviewId}</bdi>
            </Alert>
          )}
          {result.mode === 'basket' ? (
            <BasketSimulationResult result={result.value} />
          ) : (
            <HistorySimulationResult result={result.value} />
          )}
        </div>
      )}
    </div>
  );
}
