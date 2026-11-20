# SEO-04 — مدل داده، تاریخچه و همگام‌سازی خودکار

وضعیت `IN_REVIEW` است. کامیت `5cb32ddad4fab4d63be17ef7c10cdd93d4865e5e` در `seo-fix` و `origin/seo-fix` تأیید شد. پیاده‌سازی از کامیت `c2a07ca` انجام شد. اتصال پایهٔ SEO-03 با Smoke واقعی تأیید شده است.

## داده و بازیابی

- `SeoIntegration` تنظیم محلی Property و توقف موقت صف را نگه می‌دارد. `SeoSyncRun` یک کار برای هر تاریخ داده، نوع جست‌وجو و روز برنامه‌ریزی‌شده است و وضعیت، شمار تلاش، پایان، خطای ثابت و پوشش هر مجموعهٔ ابعاد را ثبت می‌کند. هیچ کلید یا توکنی در جداول ذخیره نمی‌شود.
- صف در PostgreSQL است. در هر اجرای زمان‌بند حداکثر یک کار برداشته می‌شود و PostgreSQL برای هر Property یک کار فعال را می‌پذیرد. اجارهٔ ۱۰ دقیقه‌ای و شمارهٔ تلاش اجرای متوقف‌شده را قابل بازیابی می‌کنند. نوشتن داده و اتمام کار اتمیک‌اند. تلاش منقضی‌شده اجازهٔ ثبت نتیجه ندارد. برای خطاها حداکثر پنج تلاش در هر کار با فاصلهٔ افزایشی ثبت می‌شود. خطای Google صف همان Property را به‌طور موقت مکث می‌دهد.
- روز داده بر اساس `America/Los_Angeles` و فقط از دادهٔ نهایی است. هر روز سه روز پایانی تا سه روز پیش دوباره درخواست می‌شوند. Backfill پیش‌فرض ۳۰ روز و قابل تنظیم بین ۳ تا ۹۰ روز است. Web پیش‌فرض است و Image، Video و News را می‌توان فعال کرد. تغییر فهرست نوع جست‌وجو بر کارهای تازه اثر دارد.
- `SeoPerformanceDaily` مجموع Property، Device، Query، Page، Page × Query، Page × Device و تفکیک برند Web را در مجموعه‌های مستقل نگه می‌دارد. برای هر مجموعهٔ گروه‌بندی‌شده حداکثر دو صفحهٔ ۵۰۰ ردیفی خوانده می‌شود. Google نیز سطرهای برتر را برمی‌گرداند و ممکن است برخی عبارت‌ها را پنهان کند. تعداد و رسیدن به سقف در گزارش Run ثبت می‌شود. [محدودیت سطرهای Search Analytics](https://developers.google.com/webmaster-tools/v1/searchanalytics) · [سهمیه و هزینهٔ Query](https://developers.google.com/webmaster-tools/limits)
- نسخهٔ هر ردیف روز برنامه‌ریزی و شناسهٔ Run آخرین مشاهده است. دریافت دوبارهٔ یک کلید آن را به‌روز می‌کند. پاسخ خالی یا ناقص ردیف‌های قبلی را حفظ می‌کند. در تجمیع یک مجموعه، CTR برابر مجموع کلیک تقسیم بر مجموع نمایش و رتبه با وزن نمایش است. نبود داده یا رتبهٔ کافی با `null` بیان می‌شود.
- `SeoUrlInventory` URL خام، مسیر، Query String و مسیر نرمال‌شده را نگه می‌دارد. تطبیق موجودیت بر اساس مسیر شناخته‌شده، Slug فعال یا Redirect ثبت‌شده با مقصد عمومی انجام می‌شود. Canonical و روش تطبیق جدا از کلید URL گزارش‌شده‌اند. URLهای با پارامتر متفاوت ردیف جدا دارند. قواعد لینک، Canonical، Redirect و Sitemap عمومی فروشگاه در این تسک تغییر نکردند.

## بررسی دستی

مدیر پروژه موفقیت تست‌های محلی را تأیید کرد. نتیجهٔ مهاجرت آزمایشی، E2E PostgreSQL و تطبیق زندهٔ داده در انتظار ثبت است.

ابتدا در ریشهٔ پروژه اجرا کنید:

```bash
pnpm db:generate &&
pnpm api:lint &&
pnpm api:typecheck &&
pnpm api:test --runInBand modules/seo/search-console
```

برای بررسی مهاجرت و بازیابی روی PostgreSQL جدا، Docker یک پورت آزاد فقط روی Loopback تخصیص می‌دهد:

```bash
docker run -d --name hamidian-seo04-postgres \
  -e POSTGRES_USER=hamidian -e POSTGRES_PASSWORD=seo04_local \
  -e POSTGRES_DB=hamidian_seo04_test -p 127.0.0.1::5432 postgres:18.6-alpine
docker exec hamidian-seo04-postgres pg_isready -U hamidian -d hamidian_seo04_test
```

بعد از پاسخ `accepting connections`:

```bash
seo04_address="$(docker port hamidian-seo04-postgres 5432/tcp)"
export SEO04_TEST_DATABASE_URL="postgresql://hamidian:seo04_local@${seo04_address}/hamidian_seo04_test"
DATABASE_URL="$SEO04_TEST_DATABASE_URL" pnpm exec prisma migrate deploy &&
DATABASE_URL="$SEO04_TEST_DATABASE_URL" pnpm api:test:e2e --runInBand search-console-sync
```

E2E صف را هم‌زمان claim می‌کند، انقضای Lease و تلاش دوباره را می‌سنجد و حفظ متریک‌های قبلی و اتصال URL قدیمی به محصول را بررسی می‌کند.

برای تطبیق زنده، ابتدا API محلی را با همان پایگاه دادهٔ جدا و محیط معتبر API اجرا کنید:

```bash
DATABASE_URL="$SEO04_TEST_DATABASE_URL" \
SEARCH_CONSOLE_PROPERTY='sc-domain:hamidian.shop' \
SEARCH_CONSOLE_CREDENTIALS_FILE="$HOME/.config/hamidian/search-console.json" \
SEARCH_CONSOLE_SYNC_ENABLED=true \
pnpm api:dev
```

در ترمینال دوم، همان `SEO04_TEST_DATABASE_URL` را تنظیم کنید و وضعیت صف را بخوانید. بعد از ذخیرهٔ یک روز اخیر، تاریخ همان روز را برای `compare` وارد کنید. خروجی `matches: true` خواندن Web با مجموعهٔ ابعاد Property را تطبیق می‌دهد. حالت `status` با دو تاریخ اختیاری، ردیف‌های روزانه و تجمیع بازه را هم نشان می‌دهد.

```bash
export DATABASE_URL="$SEO04_TEST_DATABASE_URL"
export SEARCH_CONSOLE_PROPERTY='sc-domain:hamidian.shop'
export SEARCH_CONSOLE_CREDENTIALS_FILE="$HOME/.config/hamidian/search-console.json"
pnpm exec tsx --tsconfig apps/api/tsconfig.json apps/api/scripts/search-console-sync.ts status
pnpm exec tsx --tsconfig apps/api/tsconfig.json apps/api/scripts/search-console-sync.ts compare YYYY-MM-DD
```

## انتشار و بازگشت

مهاجرت `20261120140000_add_search_console_history` فقط جدول‌ها، کلیدها و ایندکس‌های جدید اضافه می‌کند. در انتشار جداگانه، ابتدا مهاجرت و سپس نسخهٔ API نصب می‌شود. Worker پیش‌فرض خاموش است. برای فعال‌سازی با مجوز مدیر پروژه، تنظیمات `SEARCH_CONSOLE_*` را به محیط فرایند API برسانید. در Compose یک Override عملیاتی خارج از Git برای متغیرها و اتصال فقط‌خواندنی فایل کلید به مسیر مطلق داخل کانتینر لازم است. فایل باید فقط برای کاربر سرویس قابل خواندن باشد. دقت، بار و زمان آخرین Sync از دستور `status` بررسی می‌شوند.

برای بازگشت عملیاتی، Worker را خاموش کنید و نسخهٔ پیشین API را با همان پایگاه داده راه‌اندازی کنید. جدول‌های افزوده‌شده و تاریخچه برای فعال‌سازی دوباره باقی می‌مانند. انتشار و مهاجرت تولید هنوز انجام نشده‌اند.
