# راه‌اندازی ایران‌درگاه

این اتصال بر اساس API نسخه ۲ ایران‌درگاه است. توکن فقط در API نگه‌داری می‌شود و هرگز نباید در
Storefront، متغیرهای `NEXT_PUBLIC_*`، Git، لاگ یا تیکت پشتیبانی قرار گیرد.

## دریافت توکن

1. پس از فعال‌شدن ترمینال، وارد پنل ایران‌درگاه شوید و بخش «درگاه‌ها» را باز کنید.
2. در صورت نبود توکن، از پشتیبانی درخواست صدور توکن API کنید.
3. توکن خام فقط یک‌بار نمایش داده می‌شود؛ آن را مستقیماً در secret store سرور ذخیره کنید.

پیشوند توکن محیط آزمایشی `idg_test_` و محیط عملیاتی `idg_live_` است. V2 به `merchant_id`
نیاز ندارد.

## محیط آزمایشی

در `/etc/hamidian-silver/staging.env`:

```dotenv
PAYMENT_PROVIDER=disabled
PAYMENT_CALLBACK_URL=https://staging.hamidian.shop/api/payment/callback
IRANDARGAH_API_TOKEN=idg_test_REPLACE_WITH_TEST_TOKEN
IRANDARGAH_SANDBOX=true
IRANDARGAH_REQUEST_TIMEOUT_MS=8000
```

سپس validator staging، migration و restart سرویس API و Storefront را اجرا کنید. ایران‌درگاه را
در «تنظیمات ← درگاه‌های پرداخت» فعال و یک پرداخت sandbox کامل تا callback و ثبت `ref_id` آزمایش
کنید.

## محیط عملیاتی

در `/etc/hamidian-silver/production.env`:

```dotenv
PAYMENT_PROVIDER=disabled
PAYMENT_CALLBACK_URL=https://hamidian.shop/api/payment/callback
IRANDARGAH_API_TOKEN=idg_live_REPLACE_WITH_LIVE_TOKEN
IRANDARGAH_SANDBOX=false
IRANDARGAH_REQUEST_TIMEOUT_MS=8000
```

پیش از restart اجرا کنید:

```bash
sudo python3 deploy/validate-production-env.py
```

پس از deploy و migration، وضعیت ایران‌درگاه در پنل باید «آماده پرداخت» باشد. ابتدا یک پرداخت
کم‌مبلغ واقعی انجام دهید و این موارد را تطبیق دهید: مبلغ ریالی، شماره سفارش، authority، بازگشت به
`/api/payment/callback/<attemptId>`، تأیید سروری و ذخیره `ref_id`.

## قرارداد اتصال

- ایجاد پرداخت: `POST /v2/payments` با Bearer Token و `Idempotency-Key`
- مبلغ: ریال، از `100000` تا `4000000000`
- callback: با `action=GET` و `direct_verify=false`
- تأیید نهایی: `POST /v2/verifications` با authority و مبلغ ریالی ثبت‌شده در دیتابیس
- آدرس عملیاتی: `https://ipg.irandargah.com`
- آدرس sandbox: `https://sandbox.irandargah.com`

نتیجه callback مرورگر به‌تنهایی مبنای پرداخت موفق نیست؛ سفارش فقط پس از پاسخ موفق verification
نهایی می‌شود.

مرجع رسمی: <https://docs.irandargah.com/>
