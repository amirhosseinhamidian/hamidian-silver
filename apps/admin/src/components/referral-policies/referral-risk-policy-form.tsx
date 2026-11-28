'use client';

import { useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input, Textarea } from '@/components/ui/form-control';
import { FormField } from '@/components/ui/form-field';
import { Select, type SelectOption } from '@/components/ui/select';
import { formatAdminInteger } from '@/lib/presentation/formatters';
import {
  readReferralNumber,
  readReferralText,
  referralInstant,
  referralPolicyResponse,
} from '@/lib/reward-policies/referral-reward-policy';
import {
  actionLabels,
  binaryRiskSignals,
  caseUuid,
  confidenceLabels,
  riskLabels,
  similarityRiskSignals,
  type RiskCode,
  type RiskDefinition,
  type RiskException,
  type RiskPolicy,
  type RiskPreview,
} from '@/lib/reward-policies/referral-risk';
import { DateField, NumberField, Toggle } from './referral-fields';

const signalCodes = Object.keys(riskLabels) as RiskCode[];
const policyFields = [
  ['minSignals', 'حداقل تعداد سیگنال منطبق', 9],
  ['reviewAt', 'امتیاز ورود به بررسی', 900],
  ['holdAt', 'امتیاز تعلیق پاداش', 900],
  ['rejectAt', 'امتیاز رد پاداش با شاهد قوی', 900],
  ['reviewHours', 'مهلت پاسخ به ساعت', 720],
  ['retentionDays', 'مدت نگهداری شواهد به روز', 90],
] as const;

function readException(form: FormData, id: number): RiskException {
  const prefix = `exception-${id}-`;
  const attributionId =
    readReferralText(form, `${prefix}manual`) || readReferralText(form, `${prefix}attribution`);
  const reason = readReferralText(form, `${prefix}reason`);
  const until = referralInstant(readReferralText(form, `${prefix}until`));
  const codes = signalCodes.filter((code) => form.has(`${prefix}${code}`));
  if (!caseUuid.test(attributionId) || !until || reason.length < 3 || !codes.length)
    throw new Error('پروندهٔ معرفی، زمان پایان، دلیل و سیگنال‌های هر استثنا را کامل کنید.');
  return { attributionId, reason, until, codes };
}

export function ReferralRiskPolicyForm({
  policy,
  expectedVersion,
  canPublish,
  caseOptions,
  selectedCase,
}: Readonly<{
  policy: RiskPolicy;
  expectedVersion: number | null;
  canPublish: boolean;
  caseOptions: readonly SelectOption[];
  selectedCase: string | null;
}>) {
  const router = useRouter();
  const [exceptions, setExceptions] = useState<Array<{ id: number; value?: RiskException }>>(() =>
    policy.definition.exceptions.map((value, id) => ({ id, value })),
  );
  const nextId = useRef(exceptions.length);
  const requestKey = useRef<{ fingerprint: string; id: string } | null>(null);
  const [busy, setBusy] = useState<'simulation' | 'policies' | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [preview, setPreview] = useState<RiskPreview | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const action = submitter?.getAttribute('value') === 'publish' ? 'policies' : 'simulation';
    const form = new FormData(event.currentTarget);
    if (action === 'policies' && (!canPublish || !form.has('confirm'))) {
      setError('انتشار نسخه را تأیید کنید.');
      return;
    }
    setError('');
    setNotice('');
    setPreview(null);
    setBusy(action);
    try {
      const read = (key: string, label: string, max: number) =>
        readReferralNumber(form, key, label, max);
      const definition: RiskDefinition = {
        minSignals: read('minSignals', 'حداقل تعداد سیگنال', 9),
        reviewAt: read('reviewAt', 'امتیاز بررسی', 900),
        holdAt: read('holdAt', 'امتیاز تعلیق', 900),
        rejectAt: read('rejectAt', 'امتیاز رد', 900),
        reviewHours: read('reviewHours', 'مهلت پاسخ', 720),
        retentionDays: read('retentionDays', 'مدت نگهداری داده', 90),
        signals: policy.definition.signals.map(({ code }) => ({
          code,
          enabled: form.has(`${code}-enabled`),
          windowDays: read(`${code}-window`, 'بازهٔ بررسی', 90),
          weight: read(`${code}-weight`, 'وزن سیگنال', 100),
          threshold: binaryRiskSignals.has(code)
            ? 1
            : read(
                `${code}-threshold`,
                'آستانهٔ سیگنال',
                similarityRiskSignals.has(code) ? 100 : 86_400,
              ),
        })),
        exceptions: exceptions.map(({ id }) => readException(form, id)),
      };
      let body: object;
      if (action === 'policies') {
        const fingerprint = JSON.stringify({ definition, expectedVersion });
        if (requestKey.current?.fingerprint !== fingerprint) {
          requestKey.current = { fingerprint, id: crypto.randomUUID() };
        }
        body = { definition, expectedVersion, requestId: requestKey.current.id };
      } else {
        const attributionId =
          readReferralText(form, 'preview-attribution-manual') ||
          readReferralText(form, 'preview-attribution');
        if (attributionId && !caseUuid.test(attributionId))
          throw new Error('شناسهٔ معرفی نمونه معتبر نیست.');
        const metrics = signalCodes.flatMap((code) =>
          readReferralText(form, `${code}-sample`)
            ? [
                {
                  code,
                  value: read(
                    `${code}-sample`,
                    riskLabels[code],
                    binaryRiskSignals.has(code)
                      ? 1
                      : similarityRiskSignals.has(code)
                        ? 100
                        : 2_147_483_647,
                  ),
                },
              ]
            : [],
        );
        body = { definition, metrics, ...(attributionId ? { attributionId } : {}) };
      }
      const response = await fetch(`/api/referral-risk/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (action === 'policies') {
        const published = await referralPolicyResponse<RiskPolicy>(response);
        requestKey.current = null;
        setNotice(`نسخهٔ ${formatAdminInteger(published.version ?? 0)} منتشر شد.`);
        router.replace('/reward-policies/referral-risk?view=policy', { scroll: false });
        router.refresh();
      } else {
        setPreview(await referralPolicyResponse<RiskPreview>(response));
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'درخواست انجام نشد.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card title="سیاست سیگنال‌های ریسک">
      <form onSubmit={(event) => void submit(event)} className="space-y-5">
        <fieldset disabled={busy !== null} className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {policyFields.map(([key, label]) => (
              <NumberField key={key} name={key} label={label} value={policy.definition[key]} />
            ))}
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {policy.definition.signals.map((signal) => (
              <fieldset
                key={signal.code}
                className="space-y-2 rounded border border-[var(--admin-color-border)] p-3"
              >
                <legend className="px-1 font-bold">{riskLabels[signal.code]}</legend>
                <Toggle
                  name={`${signal.code}-enabled`}
                  label="سیگنال فعال باشد"
                  checked={signal.enabled}
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <NumberField
                    name={`${signal.code}-window`}
                    label="بازهٔ بررسی به روز"
                    value={signal.windowDays}
                  />
                  <NumberField
                    name={`${signal.code}-weight`}
                    label="وزن سیگنال"
                    value={signal.weight}
                  />
                  {!binaryRiskSignals.has(signal.code) ? (
                    <NumberField
                      name={`${signal.code}-threshold`}
                      label={
                        signal.code === 'FAST_PAYMENT'
                          ? 'حداکثر فاصله به ثانیه'
                          : similarityRiskSignals.has(signal.code)
                            ? 'حداقل درصد شباهت'
                            : 'حداقل تعداد'
                      }
                      value={signal.threshold}
                    />
                  ) : (
                    <p className="self-end text-sm">آستانهٔ تطابق یک مورد است.</p>
                  )}
                  <NumberField
                    name={`${signal.code}-sample`}
                    label={
                      binaryRiskSignals.has(signal.code)
                        ? 'مقدار نمونه (صفر یا یک)'
                        : 'مقدار نمونهٔ مشاهده‌شده'
                    }
                    value={null}
                    optional
                  />
                </div>
              </fieldset>
            ))}
          </div>
          <div className="space-y-3">
            <h3 className="font-bold">استثناهای موقت</h3>
            {exceptions.map(({ id, value }) => (
              <fieldset
                key={id}
                className="space-y-3 rounded border border-[var(--admin-color-border)] p-3"
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField id={`exception-${id}-attribution`} label="پروندهٔ معرفی">
                    {(props) => (
                      <Select
                        {...props}
                        name={`exception-${id}-attribution`}
                        defaultValue={value?.attributionId ?? selectedCase ?? ''}
                        placeholder="انتخاب پرونده"
                        options={
                          value &&
                          !caseOptions.some(({ value: option }) => option === value.attributionId)
                            ? [
                                {
                                  value: value.attributionId,
                                  label: 'پروندهٔ ثبت‌شده در این استثنا',
                                },
                                ...caseOptions,
                              ]
                            : caseOptions
                        }
                      />
                    )}
                  </FormField>
                  <details>
                    <summary className="cursor-pointer text-sm">
                      معرفی خارج از فهرست (پیشرفته)
                    </summary>
                    <FormField id={`exception-${id}-manual`} label="شناسهٔ معرفی">
                      {(props) => (
                        <Input
                          {...props}
                          name={`exception-${id}-manual`}
                          dir="ltr"
                          maxLength={36}
                        />
                      )}
                    </FormField>
                  </details>
                  <DateField
                    name={`exception-${id}-until`}
                    label="زمان پایان استثنا"
                    value={value?.until}
                  />
                </div>
                <FormField id={`exception-${id}-reason`} label="دلیل استثنا" required>
                  {(props) => (
                    <Textarea
                      {...props}
                      name={`exception-${id}-reason`}
                      defaultValue={value?.reason}
                      maxLength={250}
                      required
                    />
                  )}
                </FormField>
                <div className="grid gap-1 sm:grid-cols-2">
                  {signalCodes.map((code) => (
                    <Toggle
                      key={code}
                      name={`exception-${id}-${code}`}
                      label={riskLabels[code]}
                      checked={value?.codes.includes(code)}
                    />
                  ))}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setExceptions((rows) => rows.filter((row) => row.id !== id))}
                >
                  حذف استثنا از فرم
                </Button>
              </fieldset>
            ))}
            <Button
              size="sm"
              variant="outline"
              disabled={exceptions.length >= 30}
              onClick={() => {
                const id = nextId.current++;
                setExceptions((rows) => [...rows, { id, value: undefined }]);
              }}
            >
              افزودن استثنا
            </Button>
          </div>
          <div className="space-y-3 border-t border-[var(--admin-color-border)] pt-3">
            <FormField id="preview-attribution" label="پروندهٔ نمونه برای اعمال استثنا">
              {(props) => (
                <Select
                  {...props}
                  name="preview-attribution"
                  defaultValue={selectedCase ?? ''}
                  options={[{ value: '', label: 'بدون پروندهٔ نمونه' }, ...caseOptions]}
                />
              )}
            </FormField>
            <details>
              <summary className="cursor-pointer text-sm">نمونه خارج از فهرست (پیشرفته)</summary>
              <FormField id="preview-attribution-manual" label="شناسهٔ معرفی نمونه">
                {(props) => (
                  <Input {...props} name="preview-attribution-manual" dir="ltr" maxLength={36} />
                )}
              </FormField>
            </details>
            <Button type="submit" value="preview" variant="outline" loading={busy === 'simulation'}>
              محاسبهٔ آزمایشی
            </Button>
            {canPublish && (
              <div className="space-y-2">
                <Toggle
                  name="confirm"
                  label="انتشار تنظیمات فعلی به‌عنوان نسخهٔ جدید را تأیید می‌کنم"
                />
                <Button type="submit" value="publish" loading={busy === 'policies'}>
                  انتشار نسخهٔ جدید
                </Button>
              </div>
            )}
          </div>
        </fieldset>
        {error && <Alert tone="danger">{error}</Alert>}
        {notice && <Alert tone="success">{notice}</Alert>}
        {preview && (
          <section aria-label="نتیجهٔ آزمایشی" role="status" className="space-y-2 text-sm">
            <p>
              {actionLabels[preview.action]} · امتیاز {formatAdminInteger(preview.score)} · اطمینان{' '}
              {confidenceLabels[preview.confidence]}
            </p>
            {preview.evidence.length > 0 && (
              <ul>
                {preview.evidence.map(({ code, value }) => (
                  <li key={code}>
                    {riskLabels[code]} · {formatAdminInteger(value)}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </form>
    </Card>
  );
}
