# FEST-15 | پذیرش نهایی و آمادگی انتشار جشنواره

وضعیت اجرا `IN_PROGRESS` و وضعیت انتشار `NOT_READY` است. ممیزی در ۲۶ نوامبر ۲۰۲۶ به وقت تهران از شاخهٔ `seo-fix` و کامیت `431fc3239fcec6b6429cbdf7bc4eacd82689f15f` آغاز شد. مسیر ریشه `/Users/amirhosseinhamidian/Projects/hamidian-silver` و درخت کاری در شروع بررسی پاک بود. `HEAD`، مرجع محلی `origin/seo-fix` و پاسخ مستقیم GitHub برای `refs/heads/seo-fix` هر سه روی همین SHA بودند. اصلاح Seed، مستندات پذیرش و نرخ‌های اختصاصی در درخت کاری‌اند و SHA انتشار پس از پذیرش تثبیت می‌شود.

## تطبیق شواهد مراحل

ستون وضعیت، پذیرش تسک توسعه‌ای یا تحقق گیت همان مرحله را نشان می‌دهد. شواهد بازبینی یکپارچه در ستون جدا آمده‌اند. «موفقِ گزارش‌شده» نتیجهٔ اعلام‌شدهٔ مدیر پروژه برای اجرای لوکال است و جزئیات فرمان یا خروجی جداگانه در صورت وجود در گزارش لینک شده‌اند.

| تسک      | وضع           | شاهد                                                                                                                                          | Manual Acceptance Pending                                                        |
| -------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| FEST-01  | `DONE`        | ممیزی و تصمیم‌ها در برنامهٔ جشنواره، `e2f6a22`                                                                                                | موضوع ممیزی سندی است.                                                            |
| FEST-02  | `DONE`        | چرخه، تفکیک نوع و مهاجرت، موفق محلی، `f96e58c` [گزارش](FEST-02.md)                                                                            | کنترل چرخه در سناریوی یکپارچه                                                    |
| FEST-03A | `IN_REVIEW`   | فاصله‌گذاری و موفقیت بررسی محلی بستهٔ شروع، `e2f6a22` [بستهٔ شروع](../FESTIVAL_COMPLETION_AND_BLACK_FRIDAY_READINESS.md#گزارش-بستهٔ-شروع)     | فاصله از Sidebar و ریزش چیدمان در عرض‌های ۳۲۰، ۷۶۸ و ۱۴۴۰                        |
| FEST-03  | `IN_REVIEW`   | پاس تست محلی به گزارش مدیر پروژه، `431fc32` [گزارش](FEST-03.md)                                                                               | فرم، ادامهٔ پیش‌نویس و بازبینی سه عرض                                            |
| FEST-04  | `DONE`        | انتخابگر دو تقویم و تبدیل زمان، موفق محلی، `5dccfa0` [گزارش](FEST-04.md)                                                                      | انتخاب و بازخوانی تاریخ در پنل                                                   |
| FEST-05  | `DONE`        | انتخابگر تصویری و دامنهٔ کاتالوگ، موفق محلی، `39a566b` [گزارش](FEST-05.md)                                                                    | کاتالوگ حجیم و تعامل دستی                                                        |
| FEST-06  | `DONE`        | نسخه، آرشیو و استقلال Snapshot در دو جشنواره، اجرای مجدد PostgreSQL موفقِ گزارش‌شده، `46fa3c3` [گزارش](FEST-06.md)                            | مقایسهٔ بصری تم در دو جشنواره                                                    |
| FEST-07  | `DONE`        | طراحی لندینگ، فیلتر و پیمایش، موفق محلی، `bdf8750` [گزارش](FEST-07.md)                                                                        | لمس، صفحه‌کلید، رسانه و حجم کاتالوگ                                              |
| FEST-08  | `DONE`        | پیش‌نمایش خصوصی و چهار نما، موفق محلی، `d78ff57` [گزارش](FEST-08.md)                                                                          | نمای واقعی و مجوزها در پنل                                                       |
| FEST-09  | `DONE`        | تم محلی کارت و حفظ قیمت و سهمیه، موفق محلی، `339fb2d` [گزارش](FEST-09.md)                                                                     | مقایسهٔ تم روشن و تیره                                                           |
| FEST-10A | `DONE`        | اسلایدشوی استاندارد و رگرسیون بنرها، موفق محلی، `e2f6a22` [بستهٔ شروع](../FESTIVAL_COMPLETION_AND_BLACK_FRIDAY_READINESS.md#گزارش-بستهٔ-شروع) | رکوردهای قدیمی جایگاه `HOME` و اسلایدشو                                          |
| FEST-10  | `DONE`        | منو، اعلان و اولویت، موفق محلی، `038f553` [گزارش](FEST-10.md)                                                                                 | نمایش واقعی و حرکت کاهش‌یافته                                                    |
| FEST-11  | `DONE`        | Snapshot انتشار، noindex و بازیابی، اجرای مجدد پس از اصلاح طول عملیات موفقِ گزارش‌شده، `84605e0` [گزارش](FEST-11.md)                          | بازیابی نسخه در زبانهٔ باز و HTTP واقعی                                          |
| FEST-12  | `DONE`        | قیمت، سهمیه، پرداخت و کیف پول، اجرای مجدد موفقِ گزارش‌شده، `1f67b39` [گزارش](FEST-12.md)                                                      | خرید و رسید در محیط یکپارچه                                                      |
| FEST-13  | `DONE`        | مرکز عملیات، مرتب‌سازی و کسری سراسری، اجرای مجدد موفقِ گزارش‌شده، `8cbd2d4` [گزارش](FEST-13.md)                                               | سه نقش و توقف اضطراری همراه Audit                                                |
| FEST-14  | `DONE`        | داشبورد و تطبیق سفارش/Quote، پاس تست محلی به گزارش مدیر پروژه، `d102d98` [گزارش](FEST-14.md)                                                  | دادهٔ نماینده، مرورگر و کارایی                                                   |
| FEST-15  | `IN_PROGRESS` | ممیزی، بررسی محیط و آماده‌سازی سناریوها در همین گزارش                                                                                         | تأیید دستی مالک پروژه، نتیجهٔ کاندید نهایی، Backup/Restore و شواهد انتشار بازند. |

زیرتسک‌های مالی و عملیاتی پیشین مطابق [ردیاب اصلی](../TASK_TRACKER.md) و ارجاع‌های [ممیزی جشنواره](../FESTIVAL_COMPLETION_AND_BLACK_FRIDAY_READINESS.md#ممیزی-کد-و-شواهد-موجود) مبنای رگرسیون‌اند. به‌طور مشخص، قیمت مستقل واریانت و نمایش مشروط از [CAM-X01](CAM-X01.md)، سهمیه و تلاش دوباره از [CAM-X05](CAM-X05.md)، کیف پول از [WL-03](WL-03.md)، و تطبیق سفارش و Quote از [CM-05](CM-05.md) می‌آیند. رگرسیون‌های SEO، جایگاه و گزارش کنار تست‌های همین تسک پوشش داده می‌شوند. ادامهٔ رودمپ از `CX-03` پیش از انتشار انجام می‌شود. تست اولیهٔ نرخ‌های اختصاصی موفق گزارش شد. بررسی کامل نسخهٔ کاندید پیش از Deploy و آزمون محیط منتشرشده پس از Deploy توسط مدیر پروژه ثبت می‌شوند.

## شواهد فنی کاندید

| بررسی                                               | شاهد فعلی                                                                                                                                                                                             | وضعیت کاندید                                                                                      |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Prisma و PostgreSQL                                 | دیتابیس توسعهٔ قبلی ۱۳۰ مهاجرت کامل و صفر رکورد درحال اجرا داشت. چهار مهاجرت جشنواره در آن ثبت نشده‌اند. تمام ۱۳۴ مهاجرت روی دیتابیس مستقل QA اعمال شدند و `migrate status` به‌روز بودن را تأیید کرد. | `PASS` برای اعمال روی دیتابیس خالی QA. اعتبارسنجی کاندید و سازگاری با کپی دادهٔ فعلی جداگانه‌اند. |
| واحد API، پنل و Storefront، lint، typecheck و build | پاس‌شدن مرحله‌ای به‌گزارش مدیر پروژه در بالا                                                                                                                                                          | اجرای نهایی روی درخت کاری کاندید هنوز ثبت نشده است.                                               |
| E2E PostgreSQL، پرداخت، سهمیه، کیف پول و RBAC       | شواهد مرحله‌ای `FEST-11` تا `FEST-14` و گزارش‌های وابستگی                                                                                                                                             | اجرای نهایی ایزوله در انتظار نتیجهٔ لوکال است.                                                    |
| Playwright، SEO و امنیت Preview                     | شواهد مرحله‌ای `FEST-08` تا `FEST-11` و بازاجرای `CX-02`                                                                                                                                              | مرورگر خودکار از API شبیه‌سازی‌شده استفاده می‌کند. پذیرش یکپارچه با API محلی جدا ثبت می‌شود.      |
| PostgreSQL در CX-02                                 | در گزارش اولیه فقط Playwright به‌صراحت تأیید شد. برای `campaign-landing` در مراحل بعدی پاس گزارش شده است. اجرای دقیق `catalog-facets` همراه آن ثبت نشده است.                                          | `IN_REVIEW` تا ثبت خروجی هر دو فایل در پایگاه آزمون ایزوله                                        |
| GitHub Actions                                      | گردش `production.yml` برای Push به `frontend-v2` و `main` و PR مقصد `main` تعریف شده و اجرای دستی هم دارد. Push روی `seo-fix` آن را شروع نمی‌کند.                                                     | `NOT_RUN` در این پذیرش. هیچ اجرای دستی، PR، Merge یا Deploy انجام نشده است.                       |

۴ مهاجرت بعد از پایهٔ جشنواره عبارت‌اند از `20261125120000_festival_lifecycle`، `20261125130000_festival_theme_library`، `20261126100000_campaign_placement_display` و `20261126110000_festival_publication_snapshot`. مهاجرت پاک فقط توان اعمال زنجیرهٔ کامل را نشان می‌دهد. وجود دادهٔ پیشین، سازگاری Image قبلی و اجرای مهاجرت روی کپی بازیابی‌شده در گیت انتشار بررسی می‌شوند.

پس از آماده‌سازی محیط QA، مدیر پروژه افزودن [نرخ‌های اختصاصی جشنواره](FEST-12.md#نرخهای-اختصاصی-در-پذیرش-fest-15) را تأیید کرد. اعمال مهاجرت افزایشی `20261126120000_festival_percentage_overrides` و اجرای مجدد آزمون‌ها روی کاندید به‌روز در انتظار نتیجهٔ مدیر پروژه‌اند.

## فرمان‌های اجرای محلی مدیر پروژه

Node `24.9.0` و pnpm `11.9.0` روی میزبان تأیید شدند. این بلوک شبیه ترتیب بررسی گردش `verify` است و از کانتینر مستقل، پورت آزاد و نام دیتابیس مخصوص E2E استفاده می‌کند. تست مالی و `CX-02` هر دو در همین محیط‌اند. `pnpm verify` طبق اسکریپت ریشه lint، قرارداد، Type Check، تست‌های واحد، E2E API و بیلد سه برنامه را اجرا می‌کند. برای تعیین تکلیف `CX-02` خروجی اجرای صریح دو فایل آخر را جدا ثبت کنید. اجرای کامل این دستورات و بیلدها در این نوبت با مدیر پروژه است.

```bash
(
  cd "/Users/amirhosseinhamidian/Projects/hamidian-silver" || exit 1
  fest15_e2e_db="$(docker run -d --rm \
    -e POSTGRES_USER=hamidian -e POSTGRES_PASSWORD=fest15_e2e_local \
    -e POSTGRES_DB=hamidian_fest15_e2e -p 127.0.0.1::5432 postgres:18.6-alpine)" || exit 1
  trap 'docker stop "$fest15_e2e_db" >/dev/null' EXIT
  for attempt in {1..30}; do
    docker exec "$fest15_e2e_db" pg_isready -q -h 127.0.0.1 -U hamidian -d hamidian_fest15_e2e && break
    sleep 1
  done
  docker exec "$fest15_e2e_db" pg_isready -h 127.0.0.1 -U hamidian -d hamidian_fest15_e2e || exit 1
  fest15_e2e_address="$(docker port "$fest15_e2e_db" 5432/tcp)" || exit 1
  case "$fest15_e2e_address" in 127.0.0.1:[0-9]*) ;; *) exit 1 ;; esac
  export DATABASE_URL="postgresql://hamidian:fest15_e2e_local@${fest15_e2e_address}/hamidian_fest15_e2e?schema=public"
  export OTP_PEPPER=fest15-e2e-isolated-pepper-testing-only-12345
  export SMS_PROVIDER=disabled PAYMENT_PROVIDER=disabled SHIPPING_PROVIDER=disabled
  export SEARCH_CONSOLE_SYNC_ENABLED=false STOCK_NOTIFICATIONS_ENABLED=false
  export TELEGRAM_BOT_TOKEN= TELEGRAM_RELAY_URL= TELEGRAM_RELAY_SECRET= BALE_BOT_TOKEN=

  pnpm contracts:generate &&
  git diff -- packages/contracts/openapi.json packages/contracts/src/schema.ts &&
  pnpm db:validate &&
  pnpm exec prisma migrate deploy &&
  pnpm exec prisma migrate status &&
  pnpm api:test:e2e --runInBand 'catalog-facets|campaign-landing' &&
  pnpm verify &&
  pnpm test:critical &&
  python3 -m unittest discover -s deploy -p 'test_*.py'
)
```

نتیجهٔ `catalog-facets` و `campaign-landing` را با SHA زمان اجرا، نام پایگاه آزمایشی و خلاصهٔ Jest ثبت کنید. اگر تولید قرارداد اختلاف نشان داد، همان diff را پیش از ادامه بررسی کنید. دستور مرورگر با تنظیمات Desktop Chrome، Tablet Chrome و Mobile Chrome خود مخزن اجرا می‌شود و سرویس‌های شبیه‌سازی‌شده را روی ۴۳۱۰ و ۴۳۱۱ می‌گیرد.

```bash
cd "/Users/amirhosseinhamidian/Projects/hamidian-silver" &&
pnpm storefront:test:e2e campaign-landing.spec.ts festival-preview.spec.ts gift-finder.spec.ts \
  catalog-facets.spec.ts catalog-seo.spec.ts guide-seo.spec.ts purchase-flow.spec.ts wallet.spec.ts
```

## نقاط تصمیم انتشار

ترتیب ثبت شواهد `NOT_READY`، `TECHNICALLY_READY_MANUAL_QA_PENDING`، `MANUAL_QA_PASSED`، `READY_FOR_DEPLOYMENT`، `DEPLOYED`، `READY_FOR_FESTIVAL_ACTIVATION` و `FESTIVAL_LIVE` است. هر وضعیت باید روی SHA مربوط ثبت شود. پایان پذیرش فنی به نتیجهٔ فرمان‌ها و رفع ایرادهای مانع وابسته است. پس از تأیید دستی مالک، SHA و Image قبلی، چهار مهاجرت، Backup دیتابیس/رسانه و Restore ایزوله طبق [VPS-007](../../vps-007-local-backup-restore.fa.md)، و برنامهٔ Deploy و Smoke طبق [VPS-011](../../vps-011-production-go-live.fa.md) مستند می‌شوند. بازگشت اولیه از توقف اضطراری جشنواره و بازگرداندن نسخهٔ نمایش در چرخهٔ انتشار می‌گذرد. بازگشت Image و تصمیم مستقل Restore دیتابیس، با توجه به سفارش‌های ثبت‌شده پس از Backup، در زمان تأیید انتشار ثبت می‌شوند.

نتیجه‌های بازرسی مرحله‌به‌مرحله در [سند پذیرش دستی و محیط QA](../FESTIVAL_MANUAL_QA_AND_RELEASE_ACCEPTANCE.md) نگهداری می‌شوند.
