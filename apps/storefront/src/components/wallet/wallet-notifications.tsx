'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { formatTomanPrice } from '@/lib/catalog/presentation';
import { formatWalletDate } from '@/lib/wallet/wallet-presentation';

const path = '/api/wallet/notifications';

type Notifications = {
  activationSmsEnabled: boolean;
  expiryInAppEnabled: boolean;
  smsAvailable: boolean;
  expiryReminderAvailable: boolean;
  expiryReminder: { urgent: boolean; amountToman: number; expiresAt: string } | null;
};

export function WalletNotifications({ refreshKey }: Readonly<{ refreshKey: number }>) {
  const [loaded, setLoaded] = useState<{ key: number; data: Notifications | null }>();
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<'saved' | 'error'>();
  useEffect(() => {
    const controller = new AbortController();
    void fetch(path, { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('Wallet notifications unavailable');
        const data = (await response.json()) as Notifications;
        if (!controller.signal.aborted) setLoaded({ key: refreshKey, data });
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoaded({ key: refreshKey, data: null });
      });
    return () => controller.abort();
  }, [refreshKey]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    setFeedback(undefined);
    try {
      const response = await fetch(path, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activationSmsEnabled: form.has('activationSmsEnabled'),
          expiryInAppEnabled: form.has('expiryInAppEnabled'),
        }),
      });
      if (!response.ok) throw new Error('Wallet preferences unavailable');
      const data = (await response.json()) as Notifications;
      setLoaded((existing) =>
        existing?.key === refreshKey ? { key: refreshKey, data } : existing,
      );
      setFeedback('saved');
    } catch {
      setFeedback('error');
    } finally {
      setSaving(false);
    }
  }

  const data = loaded?.key === refreshKey ? loaded.data : undefined;
  return (
    <section
      aria-labelledby="wallet-notifications-heading"
      className="space-y-3 rounded-sm border border-[var(--sf-color-border)] p-4"
    >
      <h3 id="wallet-notifications-heading" className="text-lg font-bold">
        اعلان‌های کیف پول
      </h3>
      {data === undefined && (
        <p role="status" className="text-sm">
          در حال دریافت اعلان‌ها…
        </p>
      )}
      {data === null && (
        <p role="alert" className="text-sm">
          دریافت تنظیمات اعلان انجام نشد.
        </p>
      )}
      {data && (
        <>
          {data.expiryReminder && (
            <div role="status" className="space-y-1 text-sm">
              <p className="font-semibold">
                {data.expiryReminder.urgent ? 'انقضای اعتبار نزدیک است' : 'یادآوری انقضای اعتبار'}
              </p>
              <p>
                {formatTomanPrice(data.expiryReminder.amountToman)} تا{' '}
                <time dateTime={data.expiryReminder.expiresAt}>
                  {formatWalletDate(data.expiryReminder.expiresAt)}
                </time>{' '}
                قابل مصرف است.
              </p>
            </div>
          )}
          <form key={refreshKey} onSubmit={save} className="space-y-3 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="activationSmsEnabled"
                defaultChecked={data.activationSmsEnabled}
                disabled={saving}
              />
              پیامک فعال‌شدن اعتبار
            </label>
            {!data.smsAvailable && <p>ارسال پیامک فعال‌سازی در حال حاضر غیرفعال است.</p>}
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="expiryInAppEnabled"
                defaultChecked={data.expiryInAppEnabled}
                disabled={saving}
              />
              یادآوری انقضا در کیف پول
            </label>
            {!data.expiryReminderAvailable && <p>یادآوری انقضا در حال حاضر غیرفعال است.</p>}
            <Button type="submit" variant="outline" loading={saving} disabled={saving}>
              ذخیرهٔ تنظیمات اعلان
            </Button>
            {feedback === 'saved' && <p role="status">تنظیمات اعلان ذخیره شد.</p>}
            {feedback === 'error' && <p role="alert">ذخیرهٔ تنظیمات اعلان انجام نشد.</p>}
          </form>
        </>
      )}
    </section>
  );
}
