# MAR-10 | لینک‌های ردیابی و انتساب

وضعیت **IN_REVIEW** روی شاخهٔ `seo-fix` است. مدیر پروژه پاس شدن تست‌های لوکال MAR-09 را تأیید کرد. [گزارش MAR-09](MAR-09.md)

در تب «لینک ردیابی» کمپین، نام و وضعیت کمپین نمایش داده می‌شوند و شناسه و نام UTM از هویت ذخیره‌شده می‌آیند. سازندهٔ موجود در تنظیمات سایت نیز از انتخابگر مقصد و اعتبارسنجی یکسان استفاده می‌کند. پس از ساخت، نشانی نهایی، منبع، کانال و محتوای اختیاری نمایش داده می‌شوند و لینک قابل کپی است. با مجوز مالی، دکمهٔ گزارش داشبورد رشد را با شناسهٔ کمپین، منبع و کانال باز می‌کند. دانه‌بندی این گزارش ترکیب کمپین، منبع و کانال است. ساخت لینک برای هر منبع یا محتوا از همان هویت کمپین استفاده می‌کند.

API هنگام ساخت، مسیر و پارامترهای مقصد را بررسی می‌کند. محصول، دسته، برند، مقاله و صفحهٔ کمپین با وضعیت عمومی فعلی بررسی می‌شوند. مقصد دارای شمارهٔ صفحه در بازهٔ ۱ تا ۱٬۰۰۰ پذیرفته می‌شود. تعداد واقعی صفحات تابع داده و فیلتر است و در فروشگاه تعیین می‌شود. خطاهای مربوط به مقصد کنار همان ورودی ظاهر می‌شوند. جریان مستقیم از نشانی عادی مقصد استفاده می‌کند.

ساخت همچنان از `POST /api/v1/growth-attribution/campaign-links` و `settings.write` استفاده می‌کند. گزارش با `finance.read` باز می‌شود. هویت ثابت `utm_id` برای انتساب سفارش و گزارش رشد به کار می‌رود. اعتبارسنجی تازه در زمان صدور انجام می‌شود و لینک قدیمی از مسیر عادی Storefront و سیاست انتساب موجود عبور می‌کند. «آمادهٔ کپی» وضعیت خروجی همین فرم است و وضعیت فعالیت کمپین جدا نمایش داده می‌شود.

## تست‌های لوکال

```zsh
cd "/Users/amirhosseinhamidian/Projects/hamidian-silver" &&
pnpm api:lint &&
pnpm api:typecheck &&
pnpm api:test --runInBand modules/growth-attribution modules/campaigns modules/authorization &&
pnpm admin:lint &&
pnpm admin:typecheck &&
pnpm admin:test src/components/site-settings/campaign-link-builder.test.tsx src/components/campaigns/campaign-destination-picker.test.tsx
```

```zsh
(
  cd "/Users/amirhosseinhamidian/Projects/hamidian-silver" || exit 1

  mar10_db="$(docker run -d --rm \
    -e POSTGRES_USER=hamidian \
    -e POSTGRES_PASSWORD=mar10_local \
    -e POSTGRES_DB=hamidian_mar10_test \
    -p 127.0.0.1::5432 postgres:18.6-alpine)" || exit 1
  trap 'docker stop "$mar10_db" >/dev/null 2>&1' EXIT

  for attempt in {1..30}; do
    docker exec "$mar10_db" pg_isready -q -h 127.0.0.1 -U hamidian -d hamidian_mar10_test && break
    sleep 1
  done
  docker exec "$mar10_db" pg_isready -h 127.0.0.1 -U hamidian -d hamidian_mar10_test || exit 1

  mar10_address="$(docker port "$mar10_db" 5432/tcp)" || exit 1
  case "$mar10_address" in
    127.0.0.1:[0-9]*) ;;
    *) exit 1 ;;
  esac
  export DATABASE_URL="postgresql://hamidian:mar10_local@${mar10_address}/hamidian_mar10_test?schema=public"

  pnpm db:generate &&
  pnpm exec prisma migrate deploy &&
  pnpm api:test:e2e --runInBand 'growth-attribution|growth-revenue|campaign-operations'
)
```

۱. در یک کمپین بازاریابی از تب لینک ردیابی، منبع و محتوای نمونه وارد کنید. نشانی ساخته‌شده را کپی کنید و تطابق مقصد و پارامترها را بررسی کنید. دوباره با محتوای دیگر بسازید و یکسان بودن `utm_id` را بسنجید.

۲. از تنظیمات برای یک محصول فعال لینک بسازید. یک محصول غیرفعال یا نشانی با پارامتر UTM موجود هم امتحان کنید. خطا باید کنار مقصد دیده شود و ورودی‌های دیگر باقی بمانند.

۳. با حساب دارای مجوز مالی، گزارش منبع و کانال را باز کنید و فیلترهای اولیهٔ داشبورد را بررسی کنید. با حساب دارای مجوز ساخت لینک و بدون دسترسی مالی، ساخت و کپی را بررسی کنید. یک لینک قدیمی را نیز از همان نشانی ذخیره‌شده باز کنید.

مرور ایستا و بررسی نحو انجام شدند. مدیر پروژه پاس شدن تست‌های لوکال را تأیید کرد. نتیجهٔ بازبینی مرورگر و SHA جداگانه ثبت نشده‌اند.
