# FEST-11 | نسخهٔ انتشار و SEO جشنواره

وضعیت `DONE` روی `seo-fix`. مدیر پروژه پاس شدن تست‌های محلی را گزارش کرد و کامیت `84605e0fa606f944db075d8160613f4479cf0bc2` روی شاخه و مرجع محلی `origin/seo-fix` تأیید شد.

- تأیید، زمان‌بندی و انتشار فوری یا خودکار از اعتبارسنجی بازه، دامنهٔ محصولات، موجودی قابل فروش و قواعد بودجه عبور می‌کنند. گیت لندینگ، رزرو هم‌زمان نشانی، دسترسی رسانه و مقصد جایگاه را بررسی می‌کند. طرح ذخیره‌شده نیز در صورت وجود دوباره اعتبارسنجی می‌شود.
- فعال‌سازی، تنظیمات نمایشی جشنواره، متن، طرح، فیلترها و جایگاه‌های لندینگ را در Snapshot ثبت می‌کند. ثبت Snapshot، گذار وضعیت و سابقهٔ انتشار در یک تراکنش‌اند. فروشگاه لندینگ، منو و اعلان را از نسخهٔ منتشرشده می‌خواند و قیمت، موجودی و سهمیه را از موتور روز فروش می‌گیرد. بررسی فعالیت موجود، نسخهٔ قدیمی در زبانهٔ باز را هنگام انتشار مجدد تشخیص می‌دهد.
- در صفحه و مجموعه، نسخهٔ انتشار را می‌توان در وضعیت `DRAFT` بازیابی کرد. در صورت فعال بودن جشنواره، مسیر عملیاتی توقف و بازکردن پیش‌نویس است. بازیابی، محتوا و ارائه را در پیش‌نویس برمی‌گرداند و برای انتشار نیاز به تأیید مجدد دارد. زمان و دامنهٔ کمپین، بودجه و قوانین مالی، سفارش‌ها و سهمیه از دادهٔ جاری می‌آیند. تغییر تاریخ فعلی ممکن است با زمان‌بندی نسخهٔ قبلی ناسازگار باشد و از بازیابی نامعتبر جلوگیری شود.
- لندینگ عمومی جشنواره همیشه `noindex, follow` است و در Sitemap قرار نمی‌گیرد. صفحه‌بندی معتبر Canonical خودش را دارد و URL فیلتر به مسیر پایهٔ همان جشنواره اشاره می‌کند. Robots امکان خزیدن را حفظ می‌کند. انتشار HTML و RSC پویا است و API عمومی کش اشتراکی ندارد. اجرای `next dev` برای پاسخ HTML سیاست `no-cache, must-revalidate` خودش را می‌فرستد.
- پیش‌نویس، دورهٔ زمان‌بندی‌شده، توقف، آرشیو و دورهٔ موقتِ پایان‌یافته برای دورهٔ ناموجود HTTP ۴۰۴ دارند. دورهٔ تکرارشوندهٔ منتشرشده و پایان‌یافته تا زمان بایگانی صفحهٔ تاریخی ۲۰۰ و پیام پایان دارد. همان نشانی می‌تواند برای یک دورهٔ معتبر دیگر استفاده شود. صفحهٔ تاریخی کالا یا تخفیف جشنواره را نمایش نمی‌دهد و صفحه‌های بعدی‌اش و پایانهٔ فهرست محصولات ۴۰۴ هستند.
- مهاجرت `20261126110000_festival_publication_snapshot` یک ستون اختیاری می‌افزاید. انتشارات پیش از مهاجرت از مسیر سازگار قبلی خوانده می‌شوند و Snapshot گذشته برایشان بازسازی نمی‌شود. نسخه‌های قابل بازگردانی با انتشار یا ازسرگیری پس از مهاجرت ثبت می‌شوند.

## بررسی محلی

تست PostgreSQL جداسازی نسخهٔ عمومی از رکورد قابل ویرایش، تداخل نشانی، موجودی نامعتبر، انتخاب نسخه، کنترل Revision، پایان و آرشیو را می‌سنجد. Playwright پاسخ‌های HTTP، Canonical، Robots، Sitemap، صفحه‌بندی و Cache RSC را بررسی می‌کند.

در اجرای نخست، ثبت سابقهٔ بازیابی در تست چرخهٔ جشنواره به‌دلیل طول شناسهٔ عملیات شکست خورد. شناسه به `PUBLICATION_RESTORE` تغییر کرد تا در ستون ۲۴ کاراکتری جا شود. تست چرخه ثبت شناسه و شمارهٔ نسخهٔ بازیابی‌شده را نیز بررسی می‌کند. مدیر پروژه موفقیت اجرای مجدد را گزارش کرد.

```bash
cd "/Users/amirhosseinhamidian/Projects/hamidian-silver" &&
DATABASE_URL='postgresql://schema:schema@127.0.0.1:5432/schema' pnpm contracts:generate &&
pnpm contracts:typecheck &&
pnpm api:lint &&
pnpm api:typecheck &&
pnpm api:test --runInBand modules/campaigns modules/authorization &&
pnpm frontend:lint &&
pnpm frontend:typecheck &&
pnpm storefront:test campaign-visibility storefront-announcement &&
pnpm storefront:test:e2e campaign-landing.spec.ts festival-preview.spec.ts
```

```bash
(
  cd "/Users/amirhosseinhamidian/Projects/hamidian-silver" || exit 1
  fest11_db="$(docker run -d --rm \
    -e POSTGRES_USER=hamidian -e POSTGRES_PASSWORD=fest11_local \
    -e POSTGRES_DB=hamidian_fest11_test -p 127.0.0.1::5432 postgres:18.6-alpine)" || exit 1
  trap 'docker stop "$fest11_db" >/dev/null' EXIT
  for attempt in {1..30}; do
    docker exec "$fest11_db" pg_isready -q -h 127.0.0.1 -U hamidian -d hamidian_fest11_test && break
    sleep 1
  done
  docker exec "$fest11_db" pg_isready -h 127.0.0.1 -U hamidian -d hamidian_fest11_test || exit 1
  fest11_address="$(docker port "$fest11_db" 5432/tcp)" || exit 1
  export DATABASE_URL="postgresql://hamidian:fest11_local@${fest11_address}/hamidian_fest11_test"
  pnpm db:validate &&
  pnpm exec prisma migrate deploy &&
  pnpm api:test:e2e --runInBand 'campaign-lifecycle|campaign-landing|festival-theme-library'
)
```

در بازبینی دستی، نسخهٔ اول را منتشر کنید، کمپین را متوقف کنید و پس از بازکردن پیش‌نویس آن را بازیابی کنید. دوباره منتشر کنید و تغییر منو و لندینگ را در یک زبانهٔ از قبل باز ببینید. این بازبینی با دادهٔ نمایندهٔ محیط عملیاتی در پذیرش نهایی ثبت می‌شود.
