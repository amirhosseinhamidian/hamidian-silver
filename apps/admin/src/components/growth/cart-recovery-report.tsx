'use client';

import { useEffect, useState, type FormEvent } from 'react';
import type { components } from '@hamidian/contracts';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/form-control';
import { FormField } from '@/components/ui/form-field';
import { formatAdminInteger, toAsciiDigits } from '@/lib/presentation/formatters';

type Policy = components['schemas']['SavedCartPolicyDto'];
type Report = components['schemas']['SavedCartReportDto'];
const endpoint = '/api/growth/cart-recovery';

export function CartRecoveryReport({ canEdit }: { canEdit: boolean }) {
  const [report, setReport] = useState<Report | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    void fetch(endpoint, { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('Could not load the cart recovery report.');
        const value = (await response.json()) as Report;
        if (!controller.signal.aborted) {
          setReport(value);
          setError(null);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setError('گزارش بازیابی سبد در دسترس نیست.');
      });
    return () => controller.abort();
  }, [reload]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !report) return;
    const fields = new FormData(event.currentTarget);
    const input: Policy = {
      remindersEnabled: fields.get('remindersEnabled') === 'on',
      idleHours: Number(toAsciiDigits(String(fields.get('idleHours') ?? ''))),
      retentionDays: Number(toAsciiDigits(String(fields.get('retentionDays') ?? ''))),
    };
    setNotice(false);
    if (
      !Number.isInteger(input.idleHours) ||
      input.idleHours < 1 ||
      input.idleHours > 168 ||
      !Number.isInteger(input.retentionDays) ||
      input.retentionDays < 1 ||
      input.retentionDays > 30 ||
      input.idleHours >= input.retentionDays * 24
    ) {
      setError(
        'زمان بی‌فعالیتی بین ۱ تا ۱۶۸ ساعت و مهلت نگهداری بین ۱ تا ۳۰ روز باشد. مهلت نگهداری باید طولانی‌تر باشد.',
      );
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!response.ok) throw new Error('Could not update the cart recovery policy.');
      const policy = (await response.json()) as Policy;
      setReport({ ...report, policy });
      setNotice(true);
    } catch {
      setError('ذخیرهٔ تنظیمات بازیابی سبد انجام نشد.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="بازیابی سبدهای نیمه‌کاره">
      <div className="space-y-4">
        {error && <Alert tone="danger">{error}</Alert>}
        {!report &&
          (error ? (
            <Button variant="outline" onClick={() => setReload((current) => current + 1)}>
              دریافت دوباره
            </Button>
          ) : (
            <p role="status">در حال دریافت گزارش…</p>
          ))}
        {report && (
          <>
            <p className="text-sm">سبدهای ذخیره‌شده در ۳۰ روز گذشته</p>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {[
                ['ذخیره‌شده', report.saved],
                ['رهاشده', report.abandoned],
                ['بازیابی‌شده', report.restored],
                ['سفارش ثبت‌شده', report.ordered],
                ['سفارش پرداخت‌شده', report.paid],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-sm">{label}</dt>
                  <dd className="font-semibold">{formatAdminInteger(Number(value))}</dd>
                </div>
              ))}
              <div>
                <dt className="text-sm">نرخ بازیابی</dt>
                <dd className="font-semibold">
                  {report.abandoned
                    ? `${formatAdminInteger(Math.round((report.restored * 100) / report.abandoned))}٪`
                    : '—'}
                </dd>
              </div>
            </dl>
            {canEdit ? (
              <form
                onSubmit={(event) => void save(event)}
                className="space-y-3 border-t border-[var(--admin-color-border)] pt-4"
              >
                <Checkbox
                  name="remindersEnabled"
                  label="نمایش یادآوری در فروشگاه"
                  defaultChecked={report.policy.remindersEnabled}
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField id="cart-recovery-idle" label="شروع یادآوری پس از چند ساعت">
                    {(props) => (
                      <Input
                        {...props}
                        name="idleHours"
                        inputMode="numeric"
                        defaultValue={report.policy.idleHours}
                        required
                      />
                    )}
                  </FormField>
                  <FormField id="cart-recovery-retention" label="مهلت نگهداری به روز">
                    {(props) => (
                      <Input
                        {...props}
                        name="retentionDays"
                        inputMode="numeric"
                        defaultValue={report.policy.retentionDays}
                        required
                      />
                    )}
                  </FormField>
                </div>
                <p className="text-sm">مهلت‌ها هنگام ذخیرهٔ سبد اعمال می‌شوند.</p>
                {notice && <Alert tone="success">تنظیمات ذخیره شد.</Alert>}
                <Button type="submit" loading={busy}>
                  ذخیرهٔ تنظیمات
                </Button>
              </form>
            ) : (
              <p className="text-sm">
                یادآوری در فروشگاه {report.policy.remindersEnabled ? 'فعال' : 'غیرفعال'} است.
              </p>
            )}
          </>
        )}
      </div>
    </Card>
  );
}
