# FEST-02 — دامنه و چرخهٔ جشنواره

وضعیت `DONE` است. مبنا `e2f6a2272f00ea25d5f530a1f025cd94fc11010c` روی `seo-fix` است. کامیت `f96e58c688cadd11f0842cc038446486fea067f5` در `HEAD` و مرجع محلی `origin/seo-fix` تأیید شد. [برنامهٔ جشنواره](../FESTIVAL_COMPLETION_AND_BLACK_FRIDAY_READINESS.md)

## رفتار

- پنل دو ورودی جدا برای جشنوارهٔ فروش و کمپین بازاریابی دارد. جشنوارهٔ تازه کانال، شناسه یا نام UTM از مدیر نمی‌گیرد. سرویس برای حفظ رابطهٔ سفارش، هزینه و گزارش یک هویت داخلی می‌سازد. کمپین بازاریابی هویت ردیابی خود را وارد می‌کند و تنظیم لندینگ برای آن در پنل و API بسته است. ثبت رکورد قدیمی در نوع جشنواره تنها با انتخاب مدیر در پیش‌نویس و همراه با ثبت نسخه انجام می‌شود. هویت ردیابی، کانال و هزینهٔ ثبت‌شدهٔ آن حفظ می‌شوند. رکوردهای قدیمی به‌شکل پیش‌فرض `LEGACY` هستند.
- تأیید، زمان‌بندی و انتشار فوری جشنواره به لندینگ ذخیره‌شده، محصول قابل فروش و اعتبارسنجی دامنه، رسانه و بودجه وابسته‌اند. انتشار فوری از زمان شروع تا پیش از پایان ممکن است. انتشار زمان‌دار از Worker فعلی استفاده می‌کند و زمان و وضعیت هر کمپین زیر قفل مستقل همان ردیف کنترل می‌شوند. اگر مانع اعتبارسنجی پس از زمان‌بندی پیش بیاید، جشنواره متوقف می‌شود و علت در نسخهٔ `PUBLICATION_BLOCKED` ثبت می‌شود. پس از رفع مانع، مدیر می‌تواند دوباره آن را زمان‌بندی کند یا به پیش‌نویس بازگرداند.
- پایان خودکار و توقف موجود حفظ شده‌اند. آرشیو فقط پس از پایان جشنواره ممکن است و زمان و نسخه را ثبت می‌کند. لندینگ دورهٔ بایگانی‌شده از مسیر عمومی خارج می‌شود. اگر دورهٔ منتشرشدهٔ دیگری برای همان مسیر معتبر باشد، قرارداد انتخاب دوره برقرار است. تاریخچهٔ مدیریت، سفارش و سهمیه قابل پیگیری‌اند. برگشت مالی و محاسبهٔ قیمت از مسیر قبلی استفاده می‌کنند.
- لندینگ نوع `FESTIVAL` در پاسخ سرور `noindex, follow` است و وارد Sitemap نمی‌شود. Canonical از قرارداد موجود مسیر پیروی می‌کند. تکمیل سیاست نسخهٔ عمومی، داده‌های قدیمی جشنواره، بقیهٔ وضعیت‌های HTTP و پذیرش کش در `FEST-11` ثبت شده است. پیش‌نمایش، Wizard، کتابخانهٔ تم و انتشار نسخهٔ مستقل در مراحل مربوط پیگیری می‌شوند.

## مهاجرت و شواهد

مهاجرت `20261125120000_festival_lifecycle` نوع کمپین و زمان آرشیو را اضافه می‌کند. پیش‌فرض `LEGACY` برای سازگاری API قدیمی حفظ شده است. طبقه‌بندی انبوه، حذف یا تغییر هویت گذشته در مهاجرت وجود ندارد. برای بازگشت برنامه، نسخهٔ قبلی حفظ شود. با برگشت به API قدیمی، کنترل‌های جدید انتشار و پنهان‌کردن آرشیو در نسخهٔ قبلی در دسترس نیستند و وضعیت جشنواره‌های تازه باید در برنامهٔ بازگشت لحاظ شود.

تست DTO ساخت جشنواره بدون UTM را بررسی می‌کند. E2E روی PostgreSQL حفظ هویت و هزینهٔ کمپین قبلی، منع لندینگ کمپین بازاریابی، جلوگیری از تأیید بدون صفحه، توقف زمان‌بند پس از اتمام موجودی، انتشار فوری و زمان‌دار، پایان خودکار، آرشیو تکرارپذیر و خروج از Sitemap را می‌سنجد. Playwright روی لندینگ فعال و تکرارشوندهٔ جشنواره `noindex` را بررسی می‌کند. کنترل دستی پنل شامل ساخت هر دو نوع، تبدیل پیش‌نویس قدیمی و مشاهدهٔ کنترل‌های انتشار و آرشیو است.

```bash
cd "/Users/amirhosseinhamidian/Projects/hamidian-silver" &&
DATABASE_URL='postgresql://schema:schema@127.0.0.1:5432/schema' pnpm contracts:generate &&
pnpm contracts:typecheck &&
pnpm api:lint &&
pnpm api:typecheck &&
pnpm api:test --runInBand modules/campaigns modules/promotions modules/authorization &&
pnpm frontend:lint &&
pnpm frontend:typecheck &&
pnpm storefront:test:e2e campaign-landing.spec.ts
```

```bash
(
  cd "/Users/amirhosseinhamidian/Projects/hamidian-silver" || exit 1
  fest02_db="$(docker run -d --rm \
    -e POSTGRES_USER=hamidian -e POSTGRES_PASSWORD=fest02_local \
    -e POSTGRES_DB=hamidian_fest02_test -p 127.0.0.1::5432 postgres:18.6-alpine)" || exit 1
  trap 'docker stop "$fest02_db" >/dev/null' EXIT
  for attempt in {1..30}; do
    docker exec "$fest02_db" pg_isready -q -h 127.0.0.1 -U hamidian -d hamidian_fest02_test && break
    sleep 1
  done
  docker exec "$fest02_db" pg_isready -h 127.0.0.1 -U hamidian -d hamidian_fest02_test || exit 1
  fest02_address="$(docker port "$fest02_db" 5432/tcp)" || exit 1
  export DATABASE_URL="postgresql://hamidian:fest02_local@${fest02_address}/hamidian_fest02_test"
  pnpm exec prisma migrate deploy &&
  pnpm api:test:e2e --runInBand 'campaign-lifecycle|campaign-landing|campaign-operations|campaign-quota|promotion-checkout|growth-attribution'
)
```

مدیر پروژه موفقیت تست‌های محلی این مرحله و SHA کامیت را گزارش کرد. قراردادهای به‌روزشده در تغییرات این مرحله موجودند. نتیجهٔ جداگانهٔ بازبینی دستی پنل هنوز ثبت نشده است.
