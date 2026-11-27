'use client';

import { useRef, useState, type FormEvent } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/form-control';
import { FormField } from '@/components/ui/form-field';
import { formatAdminInteger, formatAdminToman } from '@/lib/presentation/formatters';
import {
  referralInstant,
  referralPolicyResponse,
  referralRecipients,
  readReferralIds,
  readReferralNumber,
  readReferralText,
  type ReferralDefinition,
  type ReferralRewardPreview,
} from '@/lib/reward-policies/referral-reward-policy';
import { DateField, IdsField, NumberField, Toggle } from './referral-fields';

const reasonLabels: Record<string, string> = {
  AWARDED: 'شرایط قانون برقرار است',
  PROGRAM_DISABLED: 'برنامه غیرفعال است',
  UNCONFIRMED: 'پرداخت قطعی ثبت نشده است',
  NO_MATCH: 'قانونی با این خرید مطابقت ندارد',
  USE_LIMIT: 'سقف دفعات استفاده پر شده است',
  BUDGET_LIMIT: 'بودجه یا سقف مشوق باقی نمانده است',
  VALUE_LIMIT: 'مبلغ محاسبه‌شده کمتر از یک تومان است',
};

export function ReferralSimulation({
  readPolicy,
  ruleIds,
  disabled,
}: Readonly<{
  readPolicy: () => ReferralDefinition;
  ruleIds: readonly number[];
  disabled: boolean;
}>) {
  const [lines, setLines] = useState([0]);
  const nextLine = useRef(1);
  const [result, setResult] = useState<ReferralRewardPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || disabled) return;
    const input = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const definition = readPolicy();
      const sample = {
        occurredAt:
          referralInstant(readReferralText(input, 'simulation-at')) ?? new Date().toISOString(),
        purchaseRank: readReferralNumber(input, 'simulation-rank', 'مرتبهٔ خرید', 10_000),
        confirmed: input.has('simulation-confirmed'),
        couponApplied: input.has('simulation-coupon'),
        purchaseRewardApplied: input.has('simulation-reward'),
        campaignId: readReferralText(input, 'simulation-campaign') || null,
        remainingIncentiveToman: readReferralNumber(
          input,
          'simulation-incentives',
          'سقف باقیماندهٔ مشوق',
        ),
        programCommittedToman: readReferralNumber(
          input,
          'simulation-committed',
          'تعهد قبلی برنامه',
          Number.MAX_SAFE_INTEGER,
        ),
        lines: lines.map((line) => ({
          eligibleToman: readReferralNumber(input, `simulation-line-${line}`, 'مبلغ خالص'),
          categoryIds: readReferralIds(input, `simulation-categories-${line}`),
        })),
        usage: ruleIds.map((id, index) => ({
          ruleCode: definition.rules[index].code,
          recipientUses: readReferralNumber(input, `simulation-uses-${id}`, 'دفعات قبلی', 10_000),
          committedToman: readReferralNumber(
            input,
            `simulation-budget-${id}`,
            'تعهد قبلی قانون',
            Number.MAX_SAFE_INTEGER,
          ),
        })),
      };
      const response = await fetch('/api/referral-reward-policies/simulation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ definition, sample }),
      });
      setResult(await referralPolicyResponse<ReferralRewardPreview>(response));
    } catch (error) {
      setError(error instanceof Error ? error.message : 'محاسبهٔ آزمایشی انجام نشد.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card
      title="محاسبهٔ آزمایشی"
      description="با تنظیمات فعلی فرم محاسبه می‌شود و در کیف پول تراکنشی ثبت نمی‌کند."
    >
      <form onSubmit={(event) => void submit(event)} className="space-y-4">
        <fieldset disabled={disabled || busy} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <DateField name="simulation-at" label="زمان پرداخت نمونه (خالی یعنی اکنون)" />
            <NumberField name="simulation-rank" label="شمارهٔ خرید نمونه" value={1} />
            <FormField id="simulation-campaign" label="شناسهٔ کمپین نمونه">
              {(props) => <Input {...props} name="simulation-campaign" dir="ltr" maxLength={36} />}
            </FormField>
            <NumberField
              name="simulation-incentives"
              label="سقف باقیماندهٔ کل مشوق به تومان"
              value={2_147_483_647}
            />
            <NumberField
              name="simulation-committed"
              label="تعهد قبلی برنامه در ماه به تومان"
              value={0}
            />
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1">
            <Toggle name="simulation-confirmed" label="پرداخت قطعی" checked />
            <Toggle name="simulation-coupon" label="کد تخفیف اعمال شده" />
            <Toggle name="simulation-reward" label="پاداش خرید اعمال شده" />
          </div>
          {lines.map((line, index) => (
            <div
              className="space-y-2 rounded border border-[var(--admin-color-border)] px-3 py-2"
              key={line}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold">ردیف خرید {formatAdminInteger(index + 1)}</h3>
                {lines.length > 1 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setLines((items) => items.filter((id) => id !== line))}
                  >
                    حذف ردیف
                  </Button>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <NumberField
                  name={`simulation-line-${line}`}
                  label="مبلغ خالص کالا پس از تخفیف، اعتبار و مرجوعی به تومان"
                  value={0}
                />
                <IdsField name={`simulation-categories-${line}`} label="دسته‌های کالا" />
              </div>
            </div>
          ))}
          <Button
            size="sm"
            variant="outline"
            disabled={lines.length >= 100}
            onClick={() => {
              const id = nextLine.current++;
              setLines((items) => [...items, id]);
            }}
          >
            افزودن ردیف کالا
          </Button>
          {ruleIds.length > 0 && (
            <details className="space-y-3 rounded border border-[var(--admin-color-border)] p-3">
              <summary className="cursor-pointer text-sm font-semibold">
                مصرف قبلی هر قانون در ماه
              </summary>
              {ruleIds.map((id, index) => (
                <fieldset key={id} className="grid gap-3 sm:grid-cols-2">
                  <legend className="text-sm">قانون {formatAdminInteger(index + 1)}</legend>
                  <NumberField
                    name={`simulation-uses-${id}`}
                    label="دفعات استفادهٔ قبلی دریافت‌کننده"
                    value={0}
                  />
                  <NumberField
                    name={`simulation-budget-${id}`}
                    label="تعهد قبلی قانون به تومان"
                    value={0}
                  />
                </fieldset>
              ))}
            </details>
          )}
          <Button type="submit" loading={busy}>
            اجرای آزمایشی
          </Button>
        </fieldset>
        {error && <Alert tone="danger">{error}</Alert>}
        {result && (
          <div
            role="status"
            className="space-y-3 rounded border border-[var(--admin-color-border)] p-4 text-sm"
          >
            <p className="font-bold">مجموع پاداش {formatAdminToman(result.totalToman)}</p>
            <ul className="grid gap-3 sm:grid-cols-2">
              {result.recipients.map((row) => (
                <li key={row.recipient} className="space-y-1">
                  <p className="font-semibold">
                    {referralRecipients.find(({ value }) => value === row.recipient)?.label} ·{' '}
                    {formatAdminToman(row.amountToman)}
                  </p>
                  <p>{reasonLabels[row.reason] ?? row.reason}</p>
                  {row.ruleCode && (
                    <p>
                      قانون <bdi>{row.ruleCode}</bdi> · مبلغ مشمول{' '}
                      {formatAdminToman(row.eligibleToman)}
                    </p>
                  )}
                  {row.expiryDays && <p>مهلت مصرف {formatAdminInteger(row.expiryDays)} روز</p>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </form>
    </Card>
  );
}
