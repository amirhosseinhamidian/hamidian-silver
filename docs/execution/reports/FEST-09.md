# FEST-09 | ظاهر کارت محصول در جشنواره

وضعیت `IN_REVIEW` روی `seo-fix`. این مرحله پس از `FEST-06` و `FEST-07` انجام می‌شود و پیش‌نیاز پیش‌نمایش `FEST-08` است.

در طراح لندینگ و کتابخانهٔ تم، بخش «ظاهر کارت محصولات جشنواره» رنگ سطح، حاشیه، نشان تخفیف، برچسب جشنواره، قیمت تخفیفی، سهمیه و دکمه و آیکون علاقه‌مندی را تنظیم می‌کند. فاصله‌گذاری فشرده، سایهٔ ملایم، برجستگی حاشیه هنگام اشاره و نمایش توضیح کوتاه قابل انتخاب‌اند. تم‌های قبلی رنگ سطح و متن را از پالت خود می‌گیرند و برای حاشیه از رنگ تأکید استفاده می‌کنند. گزینه‌های کارت همراه تم و Snapshot طرح ذخیره می‌شوند.

همان کارت محصول در سکشن‌های منتخب، فهرست کامل، صفحه‌های افزوده و پیش‌نمایش رندر می‌شود. محاسبه و نمایش قیمت، سهمیه، وضعیت موجودی، علاقه‌مندی، لینک خرید و رویدادهای کاتالوگ از مسیر موجود می‌آیند. تنظیمات کارت فقط در لندینگ طراحی‌شدهٔ جشنواره اعمال می‌شوند. API رنگ‌های شش‌رقمی را می‌پذیرد و کنتراست متن و کنترل‌ها را با سطح واقعی کارت بررسی می‌کند. آدرس‌ها، لینک‌های HTML، Canonical، Robots، Sitemap و JSON-LD از قرارداد موجود پیروی می‌کنند.

## بررسی محلی

تست واحد API شکل تنظیمات و رد کنتراست نامعتبر را پوشش می‌دهد. E2E دیتابیس ذخیرهٔ تنظیمات در نسخهٔ تم و استقلال Snapshot دو جشنواره را می‌سنجد. Playwright رنگ‌های کارت، مبلغ و سهمیهٔ همان محصول، کارت افزوده‌شده، مسیر خرید و ایزوله بودن ظاهر از مجموعهٔ عادی را بررسی می‌کند.

```bash
cd "/Users/amirhosseinhamidian/Projects/hamidian-silver" &&
DATABASE_URL='postgresql://schema:schema@127.0.0.1:5432/schema' pnpm contracts:generate &&
pnpm contracts:typecheck &&
pnpm api:lint &&
pnpm api:typecheck &&
pnpm api:test --runInBand modules/campaigns &&
pnpm frontend:lint &&
pnpm frontend:typecheck &&
pnpm admin:test festival-theme-library festival-designer &&
pnpm storefront:test catalog-product-card catalog-product-grid &&
pnpm storefront:test:e2e campaign-landing.spec.ts
```

```bash
(
  cd "/Users/amirhosseinhamidian/Projects/hamidian-silver" || exit 1
  fest09_db="$(docker run -d --rm \
    -e POSTGRES_USER=hamidian -e POSTGRES_PASSWORD=fest09_local \
    -e POSTGRES_DB=hamidian_fest09_test -p 127.0.0.1::5432 postgres:18.6-alpine)" || exit 1
  trap 'docker stop "$fest09_db" >/dev/null' EXIT
  for attempt in {1..30}; do
    docker exec "$fest09_db" pg_isready -q -h 127.0.0.1 -U hamidian -d hamidian_fest09_test && break
    sleep 1
  done
  docker exec "$fest09_db" pg_isready -h 127.0.0.1 -U hamidian -d hamidian_fest09_test || exit 1
  fest09_address="$(docker port "$fest09_db" 5432/tcp)" || exit 1
  export DATABASE_URL="postgresql://hamidian:fest09_local@${fest09_address}/hamidian_fest09_test"
  pnpm exec prisma migrate deploy &&
  pnpm api:test:e2e --runInBand 'festival-theme-library|campaign-landing'
)
```

در پنل یک تم تیره و یک تم روشن را روی یک جشنوارهٔ پیش‌نویس امتحان کنید. تنظیم کارت را تغییر دهید و پیش از ذخیره در پیش‌نمایش موبایل و دسکتاپ، قیمت، تخفیف، سهمیه و فوکوس صفحه‌کلید را بررسی کنید. سپس ظاهر همان محصول را در صفحهٔ عادی فروشگاه مقایسه کنید. نتیجهٔ تست، بازبینی دستی و SHA در انتظار ثبت‌اند.
