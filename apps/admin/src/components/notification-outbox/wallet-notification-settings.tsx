'use client';

import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/form-control';
import { FormField } from '@/components/ui/form-field';

export type WalletNotificationSettings = {
  version: number;
  activationSmsEnabled: boolean;
  activationIntervalMinutes: number;
  expiryInAppEnabled: boolean;
  expiryNoticeDays: number;
  expiryUrgentDays: number;
  activationSmsPreview: string;
};

export function WalletNotificationSettingsForm({
  initial,
  canWrite,
}: Readonly<{
  initial: WalletNotificationSettings;
  canWrite: boolean;
}>) {
  const [settings, setSettings] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<'saved' | 'conflict' | 'invalid' | 'error'>();

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const expiryNoticeDays = Number(form.get('expiryNoticeDays'));
    const expiryUrgentDays = Number(form.get('expiryUrgentDays'));
    if (expiryUrgentDays > expiryNoticeDays) {
      setFeedback('invalid');
      return;
    }
    setFeedback(undefined);
    setSaving(true);
    try {
      const response = await fetch('/api/notification-outbox/wallet/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expectedVersion: settings.version,
          activationSmsEnabled: form.has('activationSmsEnabled'),
          activationIntervalMinutes: Number(form.get('activationIntervalMinutes')),
          expiryInAppEnabled: form.has('expiryInAppEnabled'),
          expiryNoticeDays,
          expiryUrgentDays,
        }),
      });
      if (response.status === 409) {
        setFeedback('conflict');
        return;
      }
      if (!response.ok) throw new Error('Wallet notification settings unavailable');
      setSettings((await response.json()) as WalletNotificationSettings);
      setFeedback('saved');
    } catch {
      setFeedback('error');
    } finally {
      setSaving(false);
    }
  }

  const errors = {
    conflict: 'تنظیمات در جای دیگری تغییر کرده‌اند. برای بازبینی، صفحه را دوباره بارگذاری کنید.',
    invalid: 'بازهٔ هشدار فوری باید در بازهٔ یادآوری انقضا باشد.',
    error: 'ذخیرهٔ تنظیمات انجام نشد.',
  };
  return (
    <form onSubmit={save} className="space-y-4">
      <fieldset disabled={!canWrite || saving} className="space-y-4">
        <Card title="پیامک فعال‌سازی اعتبار">
          <div className="space-y-3 text-sm">
            <blockquote className="whitespace-pre-line rounded border border-[var(--admin-color-border)] p-3">
              {settings.activationSmsPreview}
            </blockquote>
            <label className="flex items-center gap-2">
              <input
                name="activationSmsEnabled"
                type="checkbox"
                defaultChecked={settings.activationSmsEnabled}
              />
              تأیید متن و فعال‌کردن ارسال برای مشتریان داوطلب
            </label>
            <FormField
              id="activationIntervalMinutes"
              label="حداقل فاصلهٔ ارسال برای هر مشتری (دقیقه)"
              required
            >
              {(props) => (
                <Input
                  {...props}
                  name="activationIntervalMinutes"
                  type="number"
                  min={0}
                  max={1440}
                  defaultValue={settings.activationIntervalMinutes}
                  required
                />
              )}
            </FormField>
          </div>
        </Card>
        <Card title="یادآوری انقضا در کیف پول">
          <div className="space-y-3 text-sm">
            <label className="flex items-center gap-2">
              <input
                name="expiryInAppEnabled"
                type="checkbox"
                defaultChecked={settings.expiryInAppEnabled}
              />
              نمایش یادآوری بر اساس ترجیح مشتری
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField id="expiryNoticeDays" label="شروع یادآوری (روز مانده)" required>
                {(props) => (
                  <Input
                    {...props}
                    name="expiryNoticeDays"
                    type="number"
                    min={1}
                    max={90}
                    defaultValue={settings.expiryNoticeDays}
                    required
                  />
                )}
              </FormField>
              <FormField id="expiryUrgentDays" label="شروع هشدار فوری (روز مانده)" required>
                {(props) => (
                  <Input
                    {...props}
                    name="expiryUrgentDays"
                    type="number"
                    min={1}
                    max={90}
                    defaultValue={settings.expiryUrgentDays}
                    required
                  />
                )}
              </FormField>
            </div>
          </div>
        </Card>
      </fieldset>
      {canWrite && (
        <Button type="submit" disabled={saving} loading={saving}>
          ذخیرهٔ تنظیمات
        </Button>
      )}
      {feedback === 'saved' && (
        <p role="status" className="text-sm">
          تنظیمات ذخیره شد.
        </p>
      )}
      {feedback && feedback !== 'saved' && (
        <p role="alert" className="text-sm">
          {errors[feedback]}
        </p>
      )}
    </form>
  );
}
