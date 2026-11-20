# SEO-03 — اتصال امن Google Search Console

وضعیت `IN_REVIEW` است. پیاده‌سازی روی `seo-fix` و بر پایهٔ `582eed4` انجام شد. خط مبنای آزمون محلی SEO-02 برای شروع اتصال لحاظ شد. CI و بررسی پس از انتشار در پیگیری همان تسک ثبت هستند.

## دسترسی و راه‌اندازی

1. در Google Cloud پروژهٔ حساب سرویس را انتخاب کنید و از **APIs & Services → Library → Google Search Console API** فعال بودن API را بررسی کنید. [راهنمای Google Cloud](https://docs.cloud.google.com/service-usage/docs/enable-disable)
2. در **IAM & Admin → Service Accounts** ایمیل حساب اختصاصی را بردارید. اگر فایل معتبر موجود است از همان استفاده کنید. برای تهیهٔ فایل از **Service Accounts → حساب → Keys → Add key → Create new key → JSON** اقدام کنید. فایل را خارج از مخزن با دسترسی محدود، مانند `~/.config/hamidian/search-console.json`، نگه دارید. [راهنمای کلید حساب سرویس](https://docs.cloud.google.com/iam/docs/keys-create-delete)
3. در Search Console، Property گالری را انتخاب کنید و در **Settings → Users and permissions → Add user** همان `client_email` را با سطح `Restricted` اضافه کنید. پیش‌فرض برای Domain Property مقدار `sc-domain:hamidian.shop` است. برای URL-prefix، شناسهٔ کامل با اسلش پایانی، مانند `https://hamidian.shop/`، استفاده می‌شود. [مجوز Property](https://support.google.com/webmasters/answer/7687615) · [شناسهٔ Property](https://developers.google.com/webmaster-tools/v1/sites/get)
4. برای API لوکال، `SEARCH_CONSOLE_PROPERTY` و مسیر مطلق فایل در `SEARCH_CONSOLE_CREDENTIALS_FILE` را در `apps/api/.env` تنظیم کنید. در محیط کانتینری، مسیر از داخل API به فایل Secret فقط‌خواندنی اشاره می‌کند. OAuth از scope `webmasters.readonly` استفاده می‌کند و اعتبارنامه در API سرور می‌ماند. [OAuth حساب سرویس](https://developers.google.com/identity/protocols/oauth2/service-account)

## قرارداد API داخلی

مسیرهای زیر تحت `/api/v1/seo/search-console`، مجوز `settings.read` و سیاست `no-store` قرار دارند.

| مسیر                      | خروجی                                                                                                                                                                                                |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /connection`         | نتیجهٔ بررسی دسترسی به Property و کد خطای قابل پیگیری در صورت قطع اتصال.                                                                                                                             |
| `POST /performance`       | دادهٔ نهایی Search Analytics برای بازهٔ فراگیر حداکثر ۹۳ روز در `America/Los_Angeles`. ابعاد `date`، `query`، `page` و `device`، نوع جست‌وجو، فیلتر ترکیبی و `startRow`/`rowLimit` پشتیبانی می‌شوند. |
| `POST /brand-performance` | تفکیک برند و غیربرند برای Web. برچسب `google` برای طبقه‌بندی گوگل و `estimated` برای برآورد مبتنی بر عبارت جست‌وجو است.                                                                              |
| `GET /sitemaps`           | وضعیت پردازش، شمار هشدار و خطا، تاریخ ارسال و دانلود و شمار URLهای ارسالی بر حسب نوع محتوا.                                                                                                          |

در Performance، `ctr` نسبت ۰ تا ۱ است. `averagePosition` میانگین گزارش‌شدهٔ گوگل است و نبود داده با `null` نمایش داده می‌شود. `scope` و `aggregation` سطح اندازه‌گیری را نشان می‌دهند. مجموع Property از پرس‌وجوی جداگانهٔ بدون بُعد و فیلتر می‌آید. پوشش سطرهای Query به محدودیت تعداد ردیف و ناشناس بودن برخی عبارت‌ها بستگی دارد. `nextStartRow` پیشنهاد صفحهٔ بعد برای سطرهای گروه‌بندی‌شده است. [مستند Search Analytics](https://developers.google.com/webmaster-tools/v1/searchanalytics/query)

برای Property واجد شرایط و بازهٔ شروع از ۲۱ فوریهٔ ۲۰۲۶، ابتدا `brandedClassification` درخواست می‌شود. در صورت در دسترس نبودن طبقه‌بندی، برآورد بر اساس `hamidian` و شکل‌های فارسی و عربی «حمیدیان» انجام می‌شود. مقدار `null` یعنی برای آن بخش سطری دریافت نشده است. خواندن Sitemap دادهٔ URLهای ارسالی را می‌دهد. پوشش ایندکس به بررسی URL در مراحل بعد متکی است. [طبقه‌بندی برند در API](https://developers.google.com/webmaster-tools/v1/searchanalytics/query) · [مرجع Sitemap](https://developers.google.com/webmaster-tools/v1/sitemaps)

## سهمیه و بازیابی

خطاهای نرخ، سهمیه، مجوز، شناسهٔ Property، احراز هویت و Timeout کد مستقل دارند. برای خطاهای موقت تا سه تلاش با Backoff و Jitter انجام می‌شود. `Retry-After` طولانی به فراخواننده برمی‌گردد. ظرفیت هر فرایند API چهار درخواست هم‌زمان به گوگل است. روی 401، Token یک بار جایگزین می‌شود. پیام خطا از فهرست ثابت سرویس می‌آید. [خطاهای Search Console](https://developers.google.com/webmaster-tools/v1/errors) · [سهمیهٔ Search Console](https://developers.google.com/webmaster-tools/limits)

## بررسی دستی

آزمون‌های محلی نسخهٔ اولیه طبق گزارش مدیر پروژه موفق بودند. مسیر نمونه روی مک وجود نداشت. پس از تفکیک خطاهای محلی از پاسخ OAuth، اجرای دستی با مسیر واقعی در مرحلهٔ آماده‌سازی اعتبارنامهٔ محلی متوقف شد. فرایند بررسی محلی توانست همان فایل را بخواند، ساختار حساب سرویس را تأیید کند و یک امضای آفلاین بسازد. پیام‌های ثابت اکنون مسیر، مجوز خواندن، قالب JSON، فیلدهای حساب و امضای RSA را تفکیک می‌کنند. مدیر پروژه موفقیت اجرای دستی `pnpm api:lint`، `pnpm api:typecheck` و آزمون `search-console.spec.ts` روی تغییرات نهایی را تأیید کرد.

ترمینال مدیر پروژه هنگام خواندن فایل از `Downloads` خطای `Operation not permitted` داد و فرمان Smoke اجرا نشد. با دسترسی تأییدشده، همان فایل در مسیر نمونه خارج از مخزن با مجوز `0600` کپی شد. یکسان بودن کپی با فایل مبدأ و مجوز آن بررسی شدند.

اجرای دستی با مسیر نمونه از دریافت توکن عبور کرد و در بررسی Property با `access_denied` متوقف شد. اجرای مجدد به درخواست مدیر پروژه برای `sc-domain:hamidian.shop` و بازهٔ ۱ تا ۷ نوامبر ۲۰۲۶ موفق بود. نتیجه `connected`، یک ردیف Performance با سقف یک ردیف و تجمیع `byProperty`، و یک Sitemap بود.

فرمان زیر را از ریشهٔ پروژه با مسیر واقعی فایل حساب سرویس اجرا کنید. برای Property از نوع URL-prefix، مقدار `SEARCH_CONSOLE_PROPERTY` را با شناسهٔ همان Property تنظیم کنید.

```bash
SEARCH_CONSOLE_PROPERTY='sc-domain:hamidian.shop' \
SEARCH_CONSOLE_CREDENTIALS_FILE="$HOME/.config/hamidian/search-console.json" \
pnpm exec tsx --tsconfig apps/api/tsconfig.json apps/api/scripts/search-console-smoke.ts \
  2026-11-01 2026-11-07
```

اسکریپت وضعیت اتصال، تعداد ردیف‌های Performance، سطح تجمیع و تعداد Sitemapها را چاپ می‌کند.
