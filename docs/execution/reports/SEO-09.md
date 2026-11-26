# SEO-09 — موتور هشدار و مدیریت مشکلات سئو

وضعیت `IN_REVIEW` است. پیاده‌سازی از کامیت `9e9746f336332344c3682e577813a1812fc2d223` روی `seo-fix` آغاز شد. دادهٔ عملکرد از SEO-04، شواهد HTML و Sitemap از SEO-07 و نتیجهٔ URL Inspection از SEO-08 می‌آید. تطبیق زندهٔ SEO-04 در بررسی انتشار باقی است.

## قواعد و رسیدگی

- کلیک و نمایش Web از سطح PAGE در دو بازهٔ کامل و پیوستهٔ ۷روزه مقایسه می‌شوند. مقدار پایهٔ پیش‌فرض ۴۰۰ نمایش و برای هشدار کلیک دست‌کم ۳۰ کلیک است. کف نمایش صفحه‌های غیرتجاری ۱٫۵ برابر است. افت از ۴۰ درصد هشدار می‌شود. افت دست‌کم ۶۵ درصد با حجم پایهٔ دست‌کم دو برابر حداقل، بحرانی است. بازهٔ ۷ یا ۱۴ روزه و کف‌ها و درصد افت در تنظیم API قابل انتخاب‌اند.
- خطاهای قابل استناد ممیزی و تغییر Canonical یا noindex از نمونه‌های واقعی به دست می‌آیند. نتیجهٔ معتبر Google برای صفحهٔ موجود در Sitemap با HTML سالم می‌تواند مسئلهٔ «نیازمند بررسی» بسازد. هر هشدار زمان مشاهده، شواهد، شدت و لینک گزارش مربوط دارد.
- هر قاعده و آدرس در همان Property و Origin یک مورد پیگیری دارد. مشاهدهٔ تکراری شواهد را تازه می‌کند. شدت متفاوت، مشاهدهٔ رفع نشانه و بازگشت آن در تاریخچه ثبت می‌شوند. بازگشت مشکل مورد را دوباره باز می‌کند. بستن دستی، وضعیت رسیدگی را ثبت می‌کند و مشاهدهٔ تکراری همان وضعیت مورد را دوباره باز نمی‌کند.
- در «عملکرد جست‌وجو ← هشدارهای سئو» وضعیت باز، در حال رسیدگی و حل‌شده، مسئول، یادداشت، شواهد و تاریخچه در دسترس‌اند. نمایش به `settings.read` و اسکن دستی یا تغییر به `settings.write` نیاز دارد. ذخیرهٔ نسخهٔ قدیمی با پاسخ ۴۰۹ متوقف می‌شود.
- گیرنده‌های فعلی اعلان ادمین با مجوز خواندن تنظیمات برای اعلان بحرانی استفاده می‌شوند. رخداد قابل اعلان و ردیف ارسال در یک تراکنش ذخیره می‌شوند. ارسال تکراری همان رخداد برای هر گیرنده با کلید یکتا کنترل می‌شود. برای بازگشت مکرر مسئله بازهٔ آرام‌سازی ۲۴ ساعت است. افزایش شدت به بحرانی می‌تواند فوراً اعلان بگیرد. نتیجهٔ نامشخص ارسال در تاریخچه نگه داشته می‌شود و ارسال خودکار دوباره متوقف می‌شود.

## آزمون محلی

از ریشهٔ پروژه اجرا کنید.

```bash
cd "/Users/amirhosseinhamidian/Projects/hamidian-silver" &&
pnpm contracts:generate &&
pnpm api:lint &&
pnpm api:typecheck &&
pnpm api:test --runInBand modules/seo modules/authorization modules/notifications &&
pnpm admin:lint &&
pnpm admin:typecheck
```

بلوک زیر Migration و سناریوی هم‌زمانی، تعیین مسئول، بازگشت مسئله و قطع ساختگی تلگرام را با PostgreSQL موقت بررسی می‌کند.

```bash
(
  cd "/Users/amirhosseinhamidian/Projects/hamidian-silver" || exit 1
  seo09_db="$(docker run -d --rm \
    -e POSTGRES_USER=hamidian -e POSTGRES_PASSWORD=seo09_e2e_local \
    -e POSTGRES_DB=hamidian_seo09_test -p 127.0.0.1::5432 postgres:18.6-alpine)" || exit 1
  trap 'docker stop "$seo09_db" >/dev/null 2>&1' EXIT
  for attempt in {1..30}; do
    docker exec "$seo09_db" pg_isready -q -h 127.0.0.1 -U hamidian -d hamidian_seo09_test && break
    sleep 1
  done
  docker exec "$seo09_db" pg_isready -h 127.0.0.1 -U hamidian -d hamidian_seo09_test || exit 1
  seo09_address="$(docker port "$seo09_db" 5432/tcp)" || exit 1
  case "$seo09_address" in 127.0.0.1:[0-9]*) ;; *) exit 1 ;; esac
  export DATABASE_URL="postgresql://hamidian:seo09_e2e_local@${seo09_address}/hamidian_seo09_test?schema=public"

  pnpm db:generate &&
  pnpm exec prisma migrate deploy &&
  pnpm api:test:e2e --runInBand 'seo-issue-workflow|seo-index-monitoring|seo-technical-audit'
)
```

برای بررسی پنل با دادهٔ محلی، پس از Migration از صندوق هشدارها «بررسی داده‌های ثبت‌شده» را اجرا کنید. یکی از هشدارهای دارای شاهد را باز کنید و لینک منبع، تعیین مسئول، تغییر وضعیت و ثبت یادداشت را بررسی کنید. آزمون خودکار ارسال‌کنندهٔ تلگرام را شبیه‌سازی می‌کند.

## انتشار و بازگشت

مهاجرت `20261126160000_seo_issues` سه جدول اضافه می‌کند. زمان‌بندی اسکن با `SEO_ISSUES_ENABLED` و ارسال بحرانی تلگرام با `SEO_ISSUES_TELEGRAM_ENABLED` فعال می‌شوند. هر دو پیش‌فرض خاموش‌اند. ارسال از تنظیمات گیرنده و حساب ربات یا Relay موجود استفاده می‌کند. برای بازگشت، نسخهٔ پیشین API و پنل روی همان دیتابیس اجرا می‌شوند و تاریخچه در جدول‌های اضافه‌شده می‌ماند.
