# Hamidian Telegram Relay

این برنامه یک Vercel Function مستقل است که فقط پیام‌های مجاز API فروشگاه را به Telegram Bot
API منتقل می‌کند. هیچ دیتابیس، webhook یا بخشی از فروشگاه روی Vercel اجرا نمی‌شود.

## استقرار در Vercel

1. همین repository را به‌عنوان یک Project جدید در Vercel انتخاب کنید.
2. `Root Directory` را روی `apps/telegram-relay` قرار دهید.
3. Framework Preset را `Other` انتخاب کنید.
4. متغیرهای زیر را برای محیط Production تنظیم کنید:

```env
TELEGRAM_BOT_TOKEN=replace-with-the-real-bot-token
TELEGRAM_RELAY_SECRET=replace-with-at-least-32-random-characters
TELEGRAM_REQUEST_TIMEOUT_MS=8000
```

برای ساخت secret امن:

```bash
openssl rand -hex 32
```

توکن و secret را در Git، build log یا URL قرار ندهید.

## بررسی محلی

```bash
pnpm --filter @hamidian/telegram-relay check
pnpm --filter @hamidian/telegram-relay test
```

## بررسی دسترسی VPS به relay

```bash
curl -4 --connect-timeout 10 \
  -sS \
  -w '\nHTTP %{http_code}\n' \
  https://YOUR-PROJECT.vercel.app/api/health
```

پاسخ مورد انتظار:

```json
{ "ok": true, "service": "hamidian-telegram-relay" }
```

پس از موفقیت health check، ارسال مستقیم آزمایشی را از ترمینال امن خودتان بررسی کنید:

```bash
read -rsp 'Relay secret: ' TELEGRAM_RELAY_SECRET && echo
curl -4 --connect-timeout 10 \
  -sS \
  -X POST \
  -H "Authorization: Bearer ${TELEGRAM_RELAY_SECRET}" \
  -H 'Content-Type: application/json' \
  --data '{"chatId":"YOUR_NUMERIC_CHAT_ID","message":"تست اتصال رله تلگرام حمیدیان"}' \
  -w '\nHTTP %{http_code}\n' \
  https://YOUR-PROJECT.vercel.app/api/telegram/send
unset TELEGRAM_RELAY_SECRET
```

پاسخ موفق باید `ok: true` و HTTP `200` داشته باشد.

API فروشگاه با `TELEGRAM_RELAY_URL` و `TELEGRAM_RELAY_SECRET` به این endpoint متصل می‌شود.
