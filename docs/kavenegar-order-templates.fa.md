# راه‌اندازی پیامک قالبی سفارش با کاوه‌نگار

پیامک‌های مراحل سفارش از سرویس `VerifyLookup` کاوه‌نگار ارسال می‌شوند. نام قالب‌ها باید در پنل کاوه‌نگار ثبت و تأیید شده باشد و دقیقاً با مقدار متغیر محیطی متناظر یکسان باشد.

## قالب‌های لازم

در پنل کاوه‌نگار، از بخش «اعتبارسنجی / قالب‌ها» هفت قالب زیر را بسازید. نام قالب‌ها انگلیسی و بدون فاصله یا `_` است.

### تأیید پرداخت

- نام: `hamidianpayment`
- متغیر: `KAVENEGAR_PAYMENT_VERIFIED_TEMPLATE`

```text
پرداخت سفارش %token با موفقیت تایید شد.
سفارش وارد مرحله آماده‌سازی می‌شود.
نقره حمیدیان
```

### دریافت رسید کارت‌به‌کارت

- نام: `hamidianreceipt`
- متغیر: `KAVENEGAR_PAYMENT_RECEIPT_SUBMITTED_TEMPLATE`

```text
رسید کارت‌به‌کارت سفارش %token دریافت شد.
پس از بررسی نتیجه اطلاع‌رسانی می‌شود.
نقره حمیدیان
```

### رد رسید کارت‌به‌کارت

- نام: `hamidianreceiptrejected`
- متغیر: `KAVENEGAR_PAYMENT_RECEIPT_REJECTED_TEMPLATE`

```text
رسید کارت‌به‌کارت سفارش %token تایید نشد.
برای جزئیات بیشتر به صفحه سفارش خود در وبسایت گالری حمیدیان مراجعه کنید.
نقره حمیدیان
```

علت رد رسید عمداً در توکن پیامک قرار نمی‌گیرد؛ متن آزاد ممکن است محدودیت قالب کاوه‌نگار را نقض کند. علت کامل در حساب کاربری نمایش داده می‌شود.

### کد رهگیری مرسوله

- نام: `hamidiantracking`
- متغیر: `KAVENEGAR_SHIPMENT_TRACKING_TEMPLATE`

```text
کد رهگیری سفارش %token:
%token2
نقره حمیدیان
```

### ارسال سفارش

- نام: `hamidianshipped`
- متغیر: `KAVENEGAR_ORDER_SHIPPED_TEMPLATE`

```text
سفارش %token ارسال شد.
نقره حمیدیان
```

### تحویل سفارش

- نام: `hamidiandelivered`
- متغیر: `KAVENEGAR_ORDER_DELIVERED_TEMPLATE`

```text
سفارش %token تحویل شد.
از خرید شما سپاسگزاریم.
نقره حمیدیان
```

### لغو سفارش

- نام: `hamidiancancelled`
- متغیر: `KAVENEGAR_ORDER_CANCELLED_TEMPLATE`

```text
سفارش %token لغو شد.
برای جزئیات بیشتر به صفحه سفارش خود در وبسایت گالری حمیدیان مراجعه کنید.
نقره حمیدیان
```

دلیل کامل لغو سفارش در صفحه جزئیات سفارش مشتری نمایش داده می‌شود و داخل توکن پیامک قرار نمی‌گیرد.

## تنظیم production.env

بعد از تأیید همه قالب‌ها، این مقادیر را به `/etc/hamidian-silver/production.env` اضافه کنید:

```dotenv
SMS_PROVIDER=kavenegar
KAVENEGAR_API_KEY=YOUR_REAL_KAVENEGAR_API_KEY
KAVENEGAR_OTP_TEMPLATE=YOUR_APPROVED_OTP_TEMPLATE
KAVENEGAR_SENDER=
KAVENEGAR_PAYMENT_VERIFIED_TEMPLATE=hamidianpayment
KAVENEGAR_PAYMENT_RECEIPT_SUBMITTED_TEMPLATE=hamidianreceipt
KAVENEGAR_PAYMENT_RECEIPT_REJECTED_TEMPLATE=hamidianreceiptrejected
KAVENEGAR_SHIPMENT_TRACKING_TEMPLATE=hamidiantracking
KAVENEGAR_ORDER_SHIPPED_TEMPLATE=hamidianshipped
KAVENEGAR_ORDER_DELIVERED_TEMPLATE=hamidiandelivered
KAVENEGAR_ORDER_CANCELLED_TEMPLATE=hamidiancancelled
```

`KAVENEGAR_SENDER` فقط برای پیام آزاد اعلان موجودشدن کالا استفاده می‌شود. پیام‌های سفارش و OTP به sender وابسته نیستند.

فایل env و Compose را اعتبارسنجی کنید:

```bash
python3 /opt/hamidian-silver/current/deploy/validate-production-env.py /etc/hamidian-silver/production.env

docker compose \
  --project-directory /opt/hamidian-silver/current \
  --env-file /etc/hamidian-silver/production.env \
  -f /opt/hamidian-silver/current/compose.production.yaml \
  config --quiet
```

پس از استقرار image جدید API، سرویس API را با روش انتشار معمول پروژه به‌روزرسانی کنید. صرفاً restart کردن image قدیمی، کد قالبی جدید را فعال نمی‌کند.

## بررسی وضعیت آخرین پیامک‌ها

پیامک‌های صف در جدول `notification_outbox_events` ثبت می‌شوند. وضعیت آخرین رخدادها را بدون نمایش هیچ کلید محرمانه‌ای بررسی کنید:

```sql
SELECT type, status, attempts, "lastError", "createdAt", "processedAt"
FROM notification_outbox_events
ORDER BY "createdAt" DESC
LIMIT 20;
```

- `SENT`: کاوه‌نگار درخواست را پذیرفته است.
- `FAILED`: درخواست پیش از ارسال یا با پاسخ قطعی کاوه‌نگار رد شده و retry می‌شود.
- `PENDING`: worker هنوز رخداد را پردازش نکرده است.
- `UNKNOWN`: نتیجه درخواست شبکه نامشخص بوده و برای جلوگیری از پیامک تکراری خودکار ارسال نمی‌شود.

ارسال worker حداکثر تا اجرای بعدی job زمان‌بندی‌شده (حدود یک دقیقه) انجام می‌شود.
