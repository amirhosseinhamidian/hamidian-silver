# FEST-13 | مرکز عملیات جشنواره

وضعیت `DONE` روی `seo-fix` با پایهٔ `1f67b39`. مدیر پروژه پاس شدن تست‌های محلی را گزارش کرد. کامیت `8cbd2d4812b2c0e9a2edf6ada11ba87bde2eb1e0` روی شاخه و مرجع محلی `origin/seo-fix` تأیید شد. پیش‌نیازها `FEST-11` و `FEST-12` تکمیل شده‌اند.

- در **کمپین‌های فروش ← جشنواره ← مرکز عملیات** زمان شروع و پایان، زمان تا پایان در لحظهٔ بررسی، نسخهٔ انتشار و وضعیت لندینگ دیده می‌شوند. پیوند فروشگاه برای لندینگ قابل مشاهده و آرشیو عمومی دورهٔ تکرارشونده در دسترس است. وضعیت منو و اعلان با گزینش‌گر عمومی، Snapshot انتشار، بازهٔ جایگاه، موجودی و اولویت هم‌زمان تطبیق دارد. علت آخرین توقف خودکار در صورت وجود از تاریخچهٔ همان نسخه خوانده می‌شود.
- جدول سفارش ترتیب جدیدترین یا قدیمی‌ترین، فیلتر وضعیت و صفحه‌بندی دارد. ترتیب رکوردهای هم‌زمان با شناسه ثابت است. لینک جزئیات و قواعد شمارش خرید قطعی و نیازمند تطبیق از مرکز فعلی می‌آیند.
- جدول سهمیه تصویر اصلی، قیمت پیش‌فرض، وضعیت محصول، پنج واریانت فعال اول در صورت چندواریانتی بودن، موجودی قابل فروش و اعداد سهمیه را نشان می‌دهد. لینک محصول به نقش و وضعیت آن وابسته است. هشدار کسری سهمیه و فقدان قیمت پیش‌فرض در کل ردیف‌های سهمیه محاسبه می‌شود. شمار کسری از محاسبهٔ مشترک موجودی انبار پیش‌فرض استفاده می‌کند و با صفحهٔ جدول تغییر نمی‌کند.
- بخش مالی برای نقش مجاز هزینهٔ خریدهای تأییدشده، تعهد، مانده و درصد بودجهٔ درگیر را نشان می‌دهد. درصد بر مبنای سقف و ماندهٔ موتور کمپین است. دسترسی مرکز همچنان به خواندن تنظیمات و سفارش‌ها وابسته است. توقف اضطراری از گذار موجود و کنترل Revision عبور می‌کند و تاریخچه و Audit را ثبت می‌کند.
- سلامت عملیاتی بر سفارش‌های ثبت‌شده، دادهٔ قیمت و سهمیهٔ جاری و مانع انتشار تکیه دارد. برای درخواست‌های ناموفق قبل از ایجاد سفارش، شمارش مستقل منتسب به جشنواره در دادهٔ فعلی در دسترس نیست. رابط گزارش یا نمودار تحلیلی موضوع `FEST-14` است. این مرحله Migration تازه ندارد.

## اجرای محلی

```bash
cd "/Users/amirhosseinhamidian/Projects/hamidian-silver" &&
DATABASE_URL='postgresql://schema:schema@127.0.0.1:5432/schema' pnpm contracts:generate &&
pnpm contracts:typecheck &&
pnpm api:lint &&
pnpm api:typecheck &&
pnpm api:test --runInBand modules/campaigns modules/authorization modules/audit &&
pnpm admin:lint &&
pnpm admin:typecheck &&
pnpm admin:test campaign-operations-center.test.tsx &&
pnpm admin:build
```

```bash
(
  cd "/Users/amirhosseinhamidian/Projects/hamidian-silver" || exit 1
  fest13_db="$(docker run -d --rm \
    -e POSTGRES_USER=hamidian -e POSTGRES_PASSWORD=fest13_local \
    -e POSTGRES_DB=hamidian_fest13_test -p 127.0.0.1::5432 postgres:18.6-alpine)" || exit 1
  trap 'docker stop "$fest13_db" >/dev/null' EXIT
  for attempt in {1..30}; do
    docker exec "$fest13_db" pg_isready -q -h 127.0.0.1 -U hamidian -d hamidian_fest13_test && break
    sleep 1
  done
  docker exec "$fest13_db" pg_isready -h 127.0.0.1 -U hamidian -d hamidian_fest13_test || exit 1
  fest13_address="$(docker port "$fest13_db" 5432/tcp)" || exit 1
  export DATABASE_URL="postgresql://hamidian:fest13_local@${fest13_address}/hamidian_fest13_test"
  pnpm db:generate &&
  pnpm exec prisma migrate deploy &&
  pnpm api:test:e2e --runInBand 'campaign-lifecycle|campaign-landing|campaign-quota|campaign-operations'
)
```

```bash
cd "/Users/amirhosseinhamidian/Projects/hamidian-silver" &&
pnpm storefront:test:e2e campaign-landing.spec.ts
```

در بازبینی دستی، مرکز عملیات جشنواره را هنگام پیش‌نویس، انتشار و توقف باز کنید. زمان، نسخه و نمایش منو و اعلان را در فروشگاه تطبیق دهید. با نقش فقط‌خواندنی و نقش فاقد مجوز مالی، دسترسی‌ها را بررسی کنید و با نقش دارای مجوز توقف را در تاریخچه و Audit تطبیق دهید. چیدمان جدول و فوکوس را در عرض موبایل و دسکتاپ بررسی کنید.

در اجرای نخست PostgreSQL، سه مجموعه پاس شدند. تست چرخه در مقایسهٔ تنظیمات تودرتوی جایگاه‌ها شکست خورد. تست اصلاح شد تا تعداد جایگاه‌ها و تنظیمات هر جایگاه را با شناسهٔ آن بررسی کند. مدیر پروژه موفقیت اجرای مجدد را گزارش کرد. CI شاخهٔ `seo-fix` در گردش فعلی اجرا نمی‌شود.
