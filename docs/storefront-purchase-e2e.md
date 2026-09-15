# Storefront purchase E2E

`SF-FINAL-03` یک سناریوی مرورگری قطعی برای مسیر کامل خرید فراهم می‌کند:

1. ورود با OTP
2. مشاهده و افزودن محصول
3. بررسی سبد
4. ساخت سفارش با آدرس ذخیره‌شده
5. انتقال به درگاه آزمایشی
6. بازگشت از callback واقعی Storefront
7. نمایش نتیجه موفق و سفارش `PAID`

## اجرای محلی

از ریشه مخزن:

```bash
pnpm install
pnpm storefront:test:e2e
```

اجرای محلی به Google Chrome نصب‌شده روی سیستم نیاز دارد و مرورگر دیگری دانلود نمی‌کند. Playwright دو سرور موقت را مدیریت می‌کند: Storefront روی پورت `4310` و API/درگاه قطعی تست روی پورت `4311`. این پورت‌ها باید آزاد باشند. Storefront آزمایشی از build directory جداگانه `.next-e2e` استفاده می‌کند؛ بنابراین می‌تواند هم‌زمان با `next dev` معمولی اجرا شود.

شماره `09123456789` و کد `12345` فقط داخل mock محلی پذیرفته می‌شوند. mock روی loopback گوش می‌دهد، به هیچ سرویس واقعی متصل نمی‌شود و نباید در production اجرا شود. دسترسی image optimizer به رسانه loopback نیز فقط در فرایند E2E و با env داخلی runner فعال می‌شود.

در CI لینوکسی، مرورگر و وابستگی‌های سیستم را یک‌بار با فرمان زیر نصب کنید:

```bash
pnpm --filter @hamidian/storefront test:e2e:install:chromium
PLAYWRIGHT_BROWSER_CHANNEL=chromium pnpm storefront:test:e2e
```

فرمان نصب Chromium فقط برای محیط CI یا شبکه‌ای است که به CDN مرورگر Playwright دسترسی دارد.

خروجی شکست‌ها در `apps/storefront/test-results` و گزارش HTML در `apps/storefront/playwright-report` ذخیره می‌شود؛ هر دو مسیر از Git خارج شده‌اند.
