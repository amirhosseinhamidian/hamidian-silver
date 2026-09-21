'use client';

import { useState, type FormEvent } from 'react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/form-control';
import { FormField } from '@/components/ui/form-field';
import {
  parseOrderNotificationRecipientsSnapshot,
  type OrderNotificationRecipient,
  type OrderNotificationRecipientsSnapshot,
} from '@/lib/order-notifications/order-notification-recipients-model';
import { formatAdminPhone, toAsciiDigits } from '@/lib/presentation/formatters';

type Props = Readonly<{
  initialSnapshot: OrderNotificationRecipientsSnapshot;
  failed: boolean;
}>;

const CHAT_ID_PATTERN = /^-?\d{1,20}$/;

function displayName(recipient: OrderNotificationRecipient): string {
  return [recipient.firstName, recipient.lastName].filter(Boolean).join(' ') || 'مدیر بدون نام';
}

function RecipientCard({
  recipient,
  onSaved,
}: Readonly<{
  recipient: OrderNotificationRecipient;
  onSaved: (snapshot: OrderNotificationRecipientsSnapshot) => void;
}>) {
  const [telegramChatId, setTelegramChatId] = useState(recipient.telegramChatId ?? '');
  const [baleChatId, setBaleChatId] = useState(recipient.baleChatId ?? '');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const telegramInvalid = telegramChatId !== '' && !CHAT_ID_PATTERN.test(telegramChatId);
  const baleInvalid = baleChatId !== '' && !CHAT_ID_PATTERN.test(baleChatId);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (telegramInvalid || baleInvalid || pending) return;
    setPending(true);
    setError('');
    setSuccess('');
    try {
      const response = await fetch(
        `/api/order-notification-recipients/${encodeURIComponent(recipient.userId)}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            telegramChatId: telegramChatId || null,
            baleChatId: baleChatId || null,
          }),
        },
      );
      if (!response.ok) {
        if (response.status === 409)
          throw new Error('این شناسه قبلاً برای مدیر دیگری ثبت شده است.');
        if (response.status === 403)
          throw new Error('فقط مدیر ارشد می‌تواند این تنظیمات را تغییر دهد.');
        throw new Error('ذخیره تنظیمات انجام نشد. دوباره تلاش کنید.');
      }
      const snapshot = parseOrderNotificationRecipientsSnapshot(await response.json());
      if (!snapshot) throw new Error('پاسخ سرور معتبر نیست.');
      onSaved(snapshot);
      setSuccess('شناسه‌های پیام‌رسان ذخیره شد.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'ذخیره تنظیمات انجام نشد.');
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <form onSubmit={save} className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-black">{displayName(recipient)}</h2>
            <p dir="ltr" className="mt-1 text-right text-xs text-[var(--admin-color-muted)]">
              {formatAdminPhone(recipient.phone)}
            </p>
          </div>
          <div className="flex flex-wrap gap-1">
            {recipient.roles.includes('MANAGER') ? <Badge tone="danger">مدیر ارشد</Badge> : null}
            {recipient.roles.includes('ADMIN') ? <Badge tone="info">ادمین عملیات</Badge> : null}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            id={`telegram-${recipient.userId}`}
            label="Chat ID تلگرام"
            hint="شناسه عددی گفت‌وگو؛ نام کاربری یا شماره موبایل وارد نکنید."
            error={telegramInvalid ? 'شناسه باید یک عدد حداکثر ۲۰ رقمی باشد.' : undefined}
          >
            {(props) => (
              <Input
                {...props}
                dir="ltr"
                inputMode="numeric"
                autoComplete="off"
                value={telegramChatId}
                onChange={(event) => setTelegramChatId(toAsciiDigits(event.target.value).trim())}
                placeholder="123456789"
                disabled={pending}
              />
            )}
          </FormField>
          <FormField
            id={`bale-${recipient.userId}`}
            label="Chat ID بله"
            hint="شناسه عددی گفت‌وگو با ربات بله را وارد کنید."
            error={baleInvalid ? 'شناسه باید یک عدد حداکثر ۲۰ رقمی باشد.' : undefined}
          >
            {(props) => (
              <Input
                {...props}
                dir="ltr"
                inputMode="numeric"
                autoComplete="off"
                value={baleChatId}
                onChange={(event) => setBaleChatId(toAsciiDigits(event.target.value).trim())}
                placeholder="123456789"
                disabled={pending}
              />
            )}
          </FormField>
        </div>

        {error ? <Alert tone="danger">{error}</Alert> : null}
        {success ? <Alert tone="success">{success}</Alert> : null}
        <div className="flex justify-end">
          <Button type="submit" disabled={pending || telegramInvalid || baleInvalid}>
            {pending ? 'در حال ذخیره…' : 'ذخیره شناسه‌ها'}
          </Button>
        </div>
      </form>
    </Card>
  );
}

export function OrderNotificationRecipientsView({ initialSnapshot, failed }: Props) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);

  if (failed) {
    return <Alert tone="danger">دریافت تنظیمات اعلان سفارش از سرور انجام نشد.</Alert>;
  }

  return (
    <div className="space-y-5">
      {!snapshot.telegramConfigured || !snapshot.baleConfigured ? (
        <Alert tone="warning" title="توکن یکی از پیام‌رسان‌ها تنظیم نشده است">
          {!snapshot.telegramConfigured ? 'TELEGRAM_BOT_TOKEN' : null}
          {!snapshot.telegramConfigured && !snapshot.baleConfigured ? ' و ' : null}
          {!snapshot.baleConfigured ? 'BALE_BOT_TOKEN' : null}
          {' باید در محیط API تنظیم شود؛ تا آن زمان ارسال آن کانال در صف retry می‌ماند.'}
        </Alert>
      ) : (
        <Alert tone="success">اتصال هر دو ربات در محیط API پیکربندی شده است.</Alert>
      )}

      <Alert tone="info" title="پیش‌نیاز دریافت پیام">
        هر مدیر باید ابتدا ربات مربوط را در تلگرام یا بله Start کند؛ سپس Chat ID عددی همان گفت‌وگو
        اینجا ثبت شود.
      </Alert>

      {snapshot.recipients.length ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {snapshot.recipients.map((recipient) => (
            <RecipientCard key={recipient.userId} recipient={recipient} onSaved={setSnapshot} />
          ))}
        </div>
      ) : (
        <Alert tone="neutral">ادمین یا مدیر فعال برای اتصال پیدا نشد.</Alert>
      )}
    </div>
  );
}
