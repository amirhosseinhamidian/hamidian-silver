'use client';

import { useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { formatAdminDateTime, formatAdminInteger } from '@/lib/presentation/formatters';
import {
  readReferralNumber,
  readReferralText,
  referralInstant,
  referralPolicyPath,
  referralPolicyResponse,
  type ReferralDefinition,
  type ReferralRecipient,
  type ReferralRule,
  type ReferralVersionDetail,
} from '@/lib/reward-policies/referral-reward-policy';
import {
  DateField,
  NumberField,
  readReferralRule,
  ReferralRuleFields,
  Toggle,
} from './referral-fields';
import { ReferralSimulation } from './referral-simulation';

const initial: ReferralDefinition = { enabled: false, periodBudgetToman: 0, rules: [] };

function newRule(id: number, recipient: ReferralRecipient): ReferralRule {
  return {
    code: `rule-${id + 1}`,
    recipient,
    enabled: true,
    priority: 10,
    purchaseRank: 'FIRST',
    method: 'FIXED',
    value: 1,
    minimumToman: 0,
    maximumExclusiveToman: null,
    capToman: 1,
    expiryDays: 270,
    maxUsesPerRecipient: 1,
    periodBudgetToman: 0,
    allowedCategoryIds: [],
    campaignIds: [],
    allowCampaign: false,
    allowCoupon: false,
    allowPurchaseReward: false,
  };
}

export function ReferralEditor({
  selected,
  canWrite,
  historyPage,
}: Readonly<{
  selected: ReferralVersionDetail | null;
  canWrite: boolean;
  historyPage: number;
}>) {
  const router = useRouter();
  const policy = selected?.definition ?? initial;
  const [rules, setRules] = useState(() => policy.rules.map((rule, id) => ({ id, rule })));
  const nextId = useRef(policy.rules.length);
  const formRef = useRef<HTMLFormElement>(null);
  const requestKey = useRef<{ payload: string; requestId: string } | null>(null);
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  function addRule(recipient: ReferralRecipient) {
    const id = nextId.current++;
    setRules((current) => [...current, { id, rule: newRule(id, recipient) }]);
  }
  function readPolicy() {
    const form = formRef.current;
    if (!form?.reportValidity()) throw new Error('فیلدهای سیاست را کامل کنید.');
    const data = new FormData(form);
    return {
      enabled: data.has('program-enabled'),
      periodBudgetToman: readReferralNumber(data, 'program-budget', 'بودجهٔ برنامه'),
      rules: rules.map(({ id }) => readReferralRule(data, id)),
    };
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWrite || inFlight.current) return;
    const form = new FormData(event.currentTarget);
    setError('');
    setNotice('');
    try {
      const payload = {
        definition: readPolicy(),
        requestedEffectiveAt: referralInstant(readReferralText(form, 'program-effective')),
      };
      const key = JSON.stringify(payload);
      if (requestKey.current?.payload !== key) {
        requestKey.current = { payload: key, requestId: crypto.randomUUID() };
      }
      inFlight.current = true;
      setBusy(true);
      const response = await fetch('/api/referral-reward-policies/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, requestId: requestKey.current.requestId }),
      });
      const draft = await referralPolicyResponse<ReferralVersionDetail>(response);
      requestKey.current = null;
      setNotice(`پیش‌نویس نسخهٔ ${formatAdminInteger(draft.version)} ثبت شد.`);
      router.push(`${referralPolicyPath}?page=${historyPage}&version=${draft.version}`, {
        scroll: false,
      });
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'ذخیرهٔ پیش‌نویس انجام نشد.');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <>
      <Card
        title={
          selected ? `تنظیمات نسخهٔ ${formatAdminInteger(selected.version)}` : 'تنظیمات پاداش معرفی'
        }
        description="برای تغییر تنظیمات، پیش‌نویس جدید ذخیره کنید. انتشار از پیش‌نویس ذخیره‌شده انجام می‌شود."
      >
        <form ref={formRef} onSubmit={(event) => void save(event)} className="space-y-4">
          <fieldset disabled={busy} className="space-y-4">
            <Toggle name="program-enabled" label="پاداش معرفی فعال باشد" checked={policy.enabled} />
            <div className="grid gap-3 sm:grid-cols-2">
              <NumberField
                name="program-budget"
                label="بودجهٔ ماهانهٔ مجموع پاداش معرفی به تومان"
                value={policy.periodBudgetToman}
              />
              {canWrite && (
                <DateField
                  name="program-effective"
                  label="زمان اجرای پیش‌نویس جدید (خالی یعنی هنگام انتشار)"
                  value={selected?.publishedAt ? null : selected?.requestedEffectiveAt}
                />
              )}
            </div>
            {rules.map(({ id, rule }, index) => (
              <Card
                key={id}
                title={`قانون ${formatAdminInteger(index + 1)}`}
                action={
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setRules((current) => current.filter((row) => row.id !== id))}
                  >
                    حذف قانون از فرم
                  </Button>
                }
              >
                <ReferralRuleFields index={id} rule={rule} />
              </Card>
            ))}
            {rules.length === 0 && (
              <p className="text-sm text-[var(--admin-color-muted)]">هنوز قانونی تعیین نشده است.</p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={rules.length >= 30}
                onClick={() => addRule('REFERRER')}
              >
                افزودن قانون معرف
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={rules.length >= 30}
                onClick={() => addRule('REFERRED')}
              >
                افزودن قانون معرفی‌شونده
              </Button>
            </div>
            {canWrite && (
              <Button type="submit" loading={busy}>
                ذخیرهٔ پیش‌نویس جدید
              </Button>
            )}
          </fieldset>
          {error && <Alert tone="danger">{error}</Alert>}
          {notice && <Alert tone="success">{notice}</Alert>}
        </form>
      </Card>
      <ReferralSimulation
        readPolicy={readPolicy}
        ruleIds={rules.map(({ id }) => id)}
        disabled={busy}
      />
    </>
  );
}

export function ReferralPublish({ draft }: Readonly<{ draft: ReferralVersionDetail }>) {
  const router = useRouter();
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!confirmed || busy || saved) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/referral-reward-policies/publish-${draft.version}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      await referralPolicyResponse<ReferralVersionDetail>(response);
      setSaved(true);
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'انتشار انجام نشد.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card
      title={`انتشار پیش‌نویس نسخهٔ ${formatAdminInteger(draft.version)}`}
      description={
        draft.requestedEffectiveAt
          ? `اثرگذاری از ${formatAdminDateTime(draft.requestedEffectiveAt)}`
          : 'اثرگذاری از لحظهٔ انتشار'
      }
    >
      <form onSubmit={(event) => void publish(event)} className="space-y-3">
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            required
            disabled={busy || saved}
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
          />
          انتشار همین پیش‌نویس ذخیره‌شده را تأیید می‌کنم.
        </label>
        <Button type="submit" loading={busy} disabled={!confirmed || saved}>
          انتشار نسخه
        </Button>
        {error && <Alert tone="danger">{error}</Alert>}
        {saved && <Alert tone="success">نسخه منتشر شد.</Alert>}
      </form>
    </Card>
  );
}
