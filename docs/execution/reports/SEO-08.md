# SEO-08 — پایش ایندکس و تطبیق داده‌های گوگل

وضعیت `IN_REVIEW` است. پیاده‌سازی روی `seo-fix` از کامیت `3b9fcbf13990c11178e5b8a05e2ae6869fcaa4b7` شروع شد. SEO-03 اتصال فقط‌خواندنی، SEO-04 متریک‌های صفحه و SEO-07 شواهد خزش را فراهم می‌کنند. تطبیق زندهٔ Search Console مربوط به SEO-04 در بررسی انتشار باقی است.

## رفتار

- «عملکرد جست‌وجو ← پایش ایندکس» زمان مشاهده و منبع نتیجهٔ Google، خزش فنی و خواندن Sitemap را در ستون‌های مستقل نشان می‌دهد. در صورت ثبت آخرین خزش Google، زمان آن جدا نمایش داده می‌شود. نتیجهٔ ناقص یا با عمر بیش از ۳۰ روز برچسب می‌خورد. پاسخ اخیر ناموفق در کنار آخرین نتیجهٔ ذخیره‌شده نمایش داده می‌شود.
- URL Inspection نسخهٔ ثبت‌شده در ایندکس را گزارش می‌کند. اجرای خزش سایت همچنان از صفحهٔ مشکلات فنی سئو انجام می‌شود. اختلاف Canonical یا وضعیت Google در کنار HTTP 200 به‌عنوان مورد بازبینی نمایش داده می‌شود. [مرجع URL Inspection](https://developers.google.com/webmaster-tools/v1/urlInspection.index/inspect)
- نمونهٔ روزانه حداکثر ۱۸ آدرس را از یافته‌های Audit، عملکرد Web سی روز اخیر و محتوای منتشرشده انتخاب می‌کند. سقف بودجهٔ روزانه و ظرفیت آزاد صف در نمونه اعمال می‌شوند. در هر نوبت Worker، یک بررسی روی Origin مجاز انجام می‌شود. بررسی موفق بسته به اولویت بعد از ۷ یا ۳۰ روز دوباره واجد شرایط می‌شود.
- سقف محلی پیش‌فرض ۳۰ تلاش در روز برای هر Property است و در نیمه‌شب UTC بازنشانی می‌شود. درخواست پیش از ارسال سهمیه رزرو می‌کند. پایگاه داده Claim هم‌زمان را کنترل و پس از انقضای اجاره کار قطع‌شده را بازیابی می‌کند. اتمام سهمیه در Google صف را دست‌کم ۲۴ ساعت مکث می‌دهد. محدودیت نرخ دارای Retry-After با حداقل یک دقیقه اعمال می‌شود. محدودیت بدون Retry-After یک روز مکث دارد. [محدودیت‌های Google](https://developers.google.com/webmaster-tools/limits)
- «گزارش‌های Coverage» فایل انگلیسی CSV یا ZIP شامل جدول دلایل و تعداد صفحات یا فهرست نمونهٔ یک دلیل را می‌پذیرد. منبع گزارش و تاریخ واردشده کنار آن نمایش داده می‌شوند. سقف فایل و دادهٔ بازشده ۷۵۰ کیلوبایت و سقف ثبت ۱۰۰۰ ردیف است. وارد کردن همان گزارش و تاریخ تکراری محسوب می‌شود. صفحهٔ گزارش‌های Coverage منبع فایل را کنار داده‌ها نشان می‌دهد. نمایش به `settings.read` و ثبت گزارش و نمونه به `settings.write` نیاز دارد. [راهنمای Page indexing](https://support.google.com/webmasters/answer/7440203)

## آزمون محلی

از ریشهٔ مخزن اجرا کنید.

```bash
cd "/Users/amirhosseinhamidian/Projects/hamidian-silver" &&
pnpm contracts:generate &&
pnpm api:lint &&
pnpm api:typecheck &&
pnpm api:test --runInBand modules/seo modules/authorization &&
pnpm frontend:lint &&
pnpm frontend:typecheck
```

بلوک PostgreSQL موقت برای مهاجرت و تست بازیابی صف، تضاد Google با سایت و ورود Coverage.

```bash
(
  cd "/Users/amirhosseinhamidian/Projects/hamidian-silver" || exit 1
  seo08_db="$(docker run -d --rm \
    -e POSTGRES_USER=hamidian -e POSTGRES_PASSWORD=seo08_e2e_local \
    -e POSTGRES_DB=hamidian_seo08_test -p 127.0.0.1::5432 postgres:18.6-alpine)" || exit 1
  trap 'docker stop "$seo08_db" >/dev/null 2>&1' EXIT
  for attempt in {1..30}; do
    docker exec "$seo08_db" pg_isready -q -h 127.0.0.1 -U hamidian -d hamidian_seo08_test && break
    sleep 1
  done
  docker exec "$seo08_db" pg_isready -h 127.0.0.1 -U hamidian -d hamidian_seo08_test || exit 1
  seo08_address="$(docker port "$seo08_db" 5432/tcp)" || exit 1
  case "$seo08_address" in 127.0.0.1:[0-9]*) ;; *) exit 1 ;; esac
  export DATABASE_URL="postgresql://hamidian:seo08_e2e_local@${seo08_address}/hamidian_seo08_test?schema=public"

  pnpm db:generate &&
  pnpm exec prisma migrate deploy &&
  pnpm api:test:e2e --runInBand seo-index-monitoring
)
```

## آزمون اتصال واقعی

روی پایگاه دادهٔ محلی که Migration را گرفته است، API را با متغیرهای زیر اجرا کنید. مقدار Property باید همان شناسهٔ نمای انتخاب‌شده در Search Console باشد. مسیر فایل، مسیر مطلق JSON حساب سرویس قبلاً تأییدشده در SEO-03 است. حساب را از بخش **Users and permissions** همان Property در Search Console بررسی کنید. مقدار کلید در فایل محلی می‌ماند.

```bash
SEARCH_CONSOLE_PROPERTY='sc-domain:hamidian.shop' \
SEARCH_CONSOLE_CREDENTIALS_FILE="$HOME/.config/hamidian/search-console.json" \
SEO_INSPECTION_ORIGIN='https://hamidian.shop' \
SEO_INSPECTION_DAILY_LIMIT=1 \
SEO_INSPECTION_ENABLED=false \
pnpm api:dev
```

در پنل محلی روی «ثبت نمونه در صف» بزنید و پس از نوبت بعدی Worker، صفحه را تازه کنید. گزارش باید نتیجهٔ تاریخ‌دار Google یا وضعیت خطای Google را نشان دهد. شواهد فنی و Sitemap برای گزارش همان Origin نمایش داده می‌شوند. محدود کردن سقف به ۱، آزمون اتصال را به یک تلاش در روز محدود می‌کند. آزمون‌های خودکار از پاسخ ساختگی استفاده می‌کنند.

## انتشار و بازگشت

مهاجرت `20261126150000_seo_index_monitoring` سه جدول جدید اضافه می‌کند. زمان‌بندی خودکار با `SEO_INSPECTION_ENABLED=true` فعال می‌شود و مقدار پیش‌فرض خاموش است. برای بازگشت، نسخهٔ پیشین API و پنل را روی همان دیتابیس اجرا کنید. مشاهده‌ها و فایل‌های واردشده به‌صورت ردیف‌های اعتبارسنجی‌شده برای استفادهٔ دوباره باقی می‌مانند.
