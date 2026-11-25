# FEST-06 — کتابخانهٔ تم‌های جشنواره

وضعیت `IN_REVIEW` است. مبنا `39a566b0c229bb664c956c052e5159d199786a0e` روی `seo-fix` است. [برنامهٔ جشنواره](../FESTIVAL_COMPLETION_AND_BLACK_FRIDAY_READINESS.md)

## رفتار

- از فهرست جشنواره‌ها و از صفحهٔ طراحی به کتابخانهٔ تم‌ها می‌رسید. چهار تم آمادهٔ بلک فرایدی، یلدا، نوروز و مناسبت ویژه در کتابخانه‌اند. پیش‌نمایش پالت رنگ از تنظیمات همان تم ساخته می‌شود. نمایش کامل روی لندینگ از پیش‌نمایش فعلی فروشگاه استفاده می‌کند و تکمیل ابزار آن در `FEST-08` پیگیری می‌شود.
- مدیر می‌تواند تم مستقل با نام و توضیح بسازد، از تم آماده یا نسخهٔ قبلی کپی بگیرد یا نسخهٔ تازه‌ای برای همان نام ذخیره کند. فهرست و نسخه‌ها جداگانه صفحه‌بندی می‌شوند. نسخه، توضیحات و زمان ثبت قابل مشاهده‌اند. تم‌های آماده فقط برای مشاهده، انتخاب و تکثیر در نظر گرفته شده‌اند.
- آرشیو، تم را از فهرست انتخاب جدید بیرون می‌برد و تاریخچهٔ نسخه‌هایش در نمای بایگانی در دسترس است. API هنگام تغییر انتخاب به یک نسخهٔ بایگانی‌شده خطا می‌دهد. ویرایش و بازیابی طرح دارای Snapshot بایگانی‌شده ممکن است. به‌روزرسانی و آرشیو با شمارهٔ نسخهٔ آخر کنترل می‌شوند. تغییر موفق و سابقهٔ نسخه در یک تراکنش ذخیره می‌شوند.
- در Designer، انتخاب نسخه، پالت آن را در پیش‌نویس همین جشنواره کپی می‌کند. Snapshot طرح، رنگ‌ها و نام و شمارهٔ الگوی پایه را ذخیره می‌کند. تغییر رنگ در جشنواره فقط با گزینهٔ صریح ذخیره به‌عنوان تم روی کتابخانه اثر می‌گذارد. ویرایش کتابخانه و آرشیو، پالت یا Snapshot جشنواره‌های قبلی را تغییر نمی‌دهند.
- برای `FEST-06` مجموعهٔ فعلی رنگ‌ها، گرادیان، تزئین و حرکت قابل ذخیره است. تنظیمات کارت، منو و اعلان در `FEST-09` و `FEST-10` تکمیل می‌شوند. API عمومی نمایش، URL و قرارداد SEO در این مرحله تغییری ندارند.

## مهاجرت و بررسی محلی

مهاجرت `20261125130000_festival_theme_library` ساختار کتابخانه را افزایشی تغییر می‌دهد و برای هر تم موجود نسخهٔ ۱ از همان داده و تاریخ می‌سازد. درج‌های احتمالی API قبلی در فاصلهٔ به‌روزرسانی نیز هنگام ثبت تراکنش نسخهٔ اول می‌گیرند. کنترل خواندن و نوشتن از مجوزهای تنظیمات پنل استفاده می‌کند. پس از بازگشت نرم‌افزار به نسخهٔ پیش از این مرحله، رابط قدیمی اطلاعات آرشیو و تاریخچهٔ تازه را نمایش نمی‌دهد. Snapshotهای طراحی قبلی در رکورد جشنواره باقی‌اند.

تست پنل تکثیر نسخهٔ قبلی و ساخت نسخهٔ تازه بر مبنای پالت تاریخی با کنترل آخرین شمارهٔ نسخه را بررسی می‌کند. E2E پایگاه داده نسخه‌گذاری هم‌زمان، نسخهٔ نامعتبر، آرشیو، مسیر ذخیرهٔ موجود Designer و استقلال دو جشنوارهٔ استفاده‌کننده از یک نسخه را می‌سنجد. در پنل یک تم را بسازید، از یک نسخهٔ قدیمی تکثیر کنید و قبل و بعد از آرشیو، پیش‌نمایش دو جشنواره را مقایسه کنید.

```bash
cd "/Users/amirhosseinhamidian/Projects/hamidian-silver" &&
DATABASE_URL='postgresql://schema:schema@127.0.0.1:5432/schema' pnpm contracts:generate &&
pnpm contracts:typecheck &&
pnpm api:lint &&
pnpm api:typecheck &&
pnpm api:test --runInBand modules/campaigns modules/authorization &&
pnpm admin:lint &&
pnpm admin:typecheck &&
pnpm admin:test festival-theme-library critical-operations-bff &&
pnpm storefront:typecheck
```

```bash
(
  cd "/Users/amirhosseinhamidian/Projects/hamidian-silver" || exit 1
  fest06_db="$(docker run -d --rm \
    -e POSTGRES_USER=hamidian -e POSTGRES_PASSWORD=fest06_local \
    -e POSTGRES_DB=hamidian_fest06_test -p 127.0.0.1::5432 postgres:18.6-alpine)" || exit 1
  trap 'docker stop "$fest06_db" >/dev/null' EXIT
  for attempt in {1..30}; do
    docker exec "$fest06_db" pg_isready -q -h 127.0.0.1 -U hamidian -d hamidian_fest06_test && break
    sleep 1
  done
  docker exec "$fest06_db" pg_isready -h 127.0.0.1 -U hamidian -d hamidian_fest06_test || exit 1
  fest06_address="$(docker port "$fest06_db" 5432/tcp)" || exit 1
  export DATABASE_URL="postgresql://hamidian:fest06_local@${fest06_address}/hamidian_fest06_test"
  pnpm db:validate &&
  pnpm exec prisma migrate deploy &&
  pnpm api:test:e2e --runInBand 'festival-theme-library|campaign-landing|campaign-lifecycle'
)
```

قراردادهای تولیدشده در Git ثبت شدند و مدیر پروژه پاس شدن تست‌های محلی را گزارش کرد. کامیت `46fa3c327d8d7685558543182a952736ba90ae56` روی `seo-fix` و مرجع محلی `origin/seo-fix` تأیید شد. نتیجهٔ بازبینی دستی ظاهر دو جشنواره در پنل و فروشگاه برای پذیرش نهایی ثبت می‌شود. CI برای این شاخه اجرا نمی‌شود.
