# راهنمای انتشار نهایی SEO و «دانستنی‌ها»

این سند gate مرحله `SEO-10` را برای انتشار یک‌باره تغییرات `SEO-01` تا `SEO-10` تعریف می‌کند.
اجرای این راهنما به معنی مجوز Commit، Push یا Deploy در میانه مراحل نیست؛ انتشار فقط پس از سبز
شدن کامل gate و تأیید نهایی انجام می‌شود.

## دامنه تغییر دیتابیس

- migration ساخت ساختار دانستنی‌ها:
  `apps/api/prisma/migrations/20261012123000_add_guide_content_hub/migration.sql`
- migration نهایی رابط تنظیمات:
  `apps/api/prisma/migrations/20261012190000_enable_configured_catalog_hero/migration.sql`
  فقط Hero فهرست محصولات را در حالتی فعال می‌کند که هر دو تصویر دسکتاپ و موبایل از قبل ثبت شده
  باشند؛ هیچ رسانه یا محتوایی حذف نمی‌شود.
- migration ساخت دانستنی‌ها افزایشی است: enum، جدول، index و foreign key اضافه می‌کند و هیچ جدول
  موجودی را حذف یا بازنویسی نمی‌کند؛ migration دوم فقط مقدار یک تنظیم کاملاً پیکربندی‌شده را اصلاح
  می‌کند.
- `SEO-09` و `SEO-10` migration جدید ندارند.
- قرارداد OpenAPI باید بعد از آخرین تغییر API دوباره تولید و همراه کد ثبت شود.

## Gate قبل از Merge

از ریشه repository اجرا شود:

```bash
pnpm verify:seo-release
```

این فرمان به‌ترتیب قراردادها را تولید می‌کند، Prisma schema را validate می‌کند، format/lint، تمام
typecheckها، unit/integration testها، API E2E، buildهای production، تست ابزارهای deploy و Playwright
Storefront را اجرا می‌کند.

CI علاوه بر این موارد، تمام migrationها را روی PostgreSQL خالی با `prisma migrate deploy` اعمال و
با `prisma migrate status` کنترل می‌کند. CI همچنین پس از تولید قراردادها هرگونه drift در فایل‌های
زیر را رد می‌کند:

- `packages/contracts/openapi.json`
- `packages/contracts/src/schema.ts`

## ترتیب انتشار Production

پس از سبز شدن CI و فقط در انتشار نهایی:

1. تغییرات تجمیعی یک‌بار به `main` Merge شوند.
2. workflow قبل از deploy همان commit دقیق را verify کند.
3. deploy خودکار وجود حداقل `10 GiB` فضای آزاد را کنترل کند؛ هدف عملیاتی بهتر حداقل `15 GiB` است.
4. backup تازه ساخته و restore-test آن تأیید شود؛ backup تأییدشده هنگام migration نباید بیشتر از
   ۳۰ دقیقه عمر داشته باشد.
5. imageهای `migrate`، `api`، `storefront` و `admin` ساخته شوند.
6. سرویس یک‌بارمصرف `migrate`، `prisma migrate deploy` را قبل از cutover اجرا کند.
7. API، Storefront و Admin با health check بالا بیایند.
8. symlinkهای `current` و `previous` به‌صورت atomic جابه‌جا شوند.
9. release قبلی و imageهای لازم برای rollback حفظ شوند.

این ترتیب اکنون در `deploy/deploy-production.sh` enforce شده است؛ migration دستی هم‌زمان با workflow
اجرا نشود.

## Smoke test بعد از Deploy

ابتدا بررسی عمومی فعلی:

```bash
SEO_AUDIT_ORIGIN=https://hamidian.shop pnpm seo:audit
```

سپس ممیزی دانستنی‌ها. اگر هنوز مطلبی منتشر نشده است، بدون فلگ require اجرا شود. برای launch واقعی
بخش، حداقل یک مطلب منتشر و gate سخت اجرا شود:

```bash
SEO_AUDIT_ORIGIN=https://hamidian.shop \
SEO_AUDIT_REQUIRE_GUIDE=true \
pnpm seo:guide:audit
```

کنترل دستی کوتاه:

- `/guide`، جست‌وجو و صفحه مقاله در موبایل و دسکتاپ باز شوند.
- یک مقاله به محصول، دسته یا برند مرتبط باشد و لینک رفت‌وبرگشت دیده شود.
- draft و archived از مسیر عمومی و sitemap قابل دسترسی نباشند.
- تغییر slug قبلی یک `308` مستقیم به slug جدید بدهد.
- در Admin ساخت، preview داده، انتشار و بایگانی یک مطلب آزمایشی کنترل شود.

## Rollback و شکست migration

- rollback خودکار فقط نسخه application و symlink `current` را برمی‌گرداند؛ migration دیتابیس را
  down نمی‌کند.
- migration دانستنی‌ها افزایشی است، بنابراین release قبلی جدول‌های جدید را نادیده می‌گیرد.
- در خطای بعد از migration، release قبلی را فعال کنید و جدول‌ها، enumها یا رکوردهای دانستنی را
  دستی حذف نکنید.
- restore دیتابیس Production به‌صورت خودکار انجام نشود. restore فقط برای incident تأییدشده و با
  بررسی اثر آن بر سفارش، پرداخت و رسانه مجاز است.
- اگر migration پیش از تکمیل fail شد، deploy باید قبل از cutover متوقف بماند؛ خروجی Prisma و وضعیت
  `prisma migrate status` برای تشخیص نگه داشته شود.

## Search Console پس از انتشار محتوا

پس از انتشار اولین مطالب:

1. `/sitemap.xml` فقط یک‌بار submit شود.
2. `/guide` و حداقل یک `/guide/{slug}` با URL Inspection بررسی شوند.
3. Google-selected canonical با canonical اعلام‌شده مقایسه شود.
4. گزارش‌های Page indexing، Breadcrumb و Article پس از پردازش گوگل بررسی شوند.
5. queryهای جست‌وجوی داخل `/guide` برای indexing ارسال نشوند؛ این مسیرها `noindex,follow` هستند.
