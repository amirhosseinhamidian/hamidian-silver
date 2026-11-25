# FEST-10 | منو و نوار اعلان جشنواره

وضعیت `DONE` روی `seo-fix`. تنظیمات هر جایگاه در فرم لندینگ کنار اولویت و تقویم شمسی و میلادی قرار دارند. انتخاب جایگاه و گزینهٔ بنر کمپین، نمایش عمومی را کنترل می‌کنند.

- آیتم منو عنوان اختیاری، رنگ متن، پس‌زمینه، گرادیان، حاشیه، آیکون و شدت جلوه دارد. عنوان خالی از نام جشنواره خوانده می‌شود. مقصد منو همان لندینگ است. رنگ‌ها می‌توانند از تم لندینگ به ارث برسند. منوی موبایل و دسکتاپ از یک کامپوننت استفاده می‌کنند.
- نوار اعلان از کامپوننت مشترک فروشگاه، پیام اختصاصی، پالت یا رنگ‌های تم، شیوهٔ نمایش و پوشش تصویر، GIF با جایگزین ثابت، رسانه‌های جداگانه، ارتفاع و دکمهٔ قابل تنظیم استفاده می‌کند. تایمر اختیاری از پایان واقعی جشنواره خوانده می‌شود. زمان‌بندی جایگاه فقط بازهٔ نمایش را تعیین می‌کند. در صورت خالی بودن تنظیمات دکمه، دکمهٔ کمپین یا پیوند لندینگ استفاده می‌شود.
- رتبه‌بندی هر جایگاه بر اساس اولویت، سپس زمان آغاز تازه‌تر و سپس شناسهٔ کمپین است. انتخاب عمومی به وضعیت فعال، زمان‌بندی و وجود محصول قابل فروش وابسته است. پایان جایگاه یا توقف کمپین، انتخاب مجدد را فعال می‌کند. تا دریافت جایگاه بعدی، اعلان عادی به تنظیمات فروشگاه برمی‌گردد. توقف روی صفحهٔ باز با بررسی فعالیت هر ۳۰ ثانیه در زبانهٔ قابل مشاهده یا بازگشت به زبانه تشخیص داده می‌شود. شروع یک جایگاه در صفحه‌ای که هنوز جایگاه فعالی ندارد هنگام درخواست بعدی سرور دیده می‌شود.
- مهاجرت `20261126100000_campaign_placement_display` ستون اختیاری JSON به جایگاه می‌افزاید. تنظیمات به همراه همان پیش‌نویس و Snapshot نسخه ذخیره می‌شوند. رکوردهای قبلی با پیش‌فرض خود خوانده می‌شوند. بازگشت باینری پیشین برای خواندن با ستون افزوده سازگار است. ویرایش جایگاه با نسخهٔ پیشین می‌تواند تنظیم جدید آن را حذف کند.
- لینک‌های HTML و قاعدهٔ انتشار و ایندکس لندینگ از قرارداد موجود پیروی می‌کنند. اسلایدشوی استاندارد صفحهٔ نخست مسیر معرفی است. مدیر پروژه در مراحل قبلی پاس شدن آزمون رگرسیون اسلایدشو و بنر دسته و محصول را گزارش کرد.

## بررسی محلی

تست API اعتبارسنجی سبک و مقصد و E2E اولویت، توقف، مهلت، رنگ تم و ذخیرهٔ تنظیمات را پوشش می‌دهند. تست فروشگاه بازگشت اعلان عادی پس از قطع نمایش جایگاه را می‌سنجد. Playwright منوی موبایل و دسکتاپ، جهت متن، کاهش حرکت، تایمر اختیاری و توقف از روی زبانهٔ باز را پوشش می‌دهد.

```bash
cd "/Users/amirhosseinhamidian/Projects/hamidian-silver" &&
DATABASE_URL='postgresql://schema:schema@127.0.0.1:5432/schema' pnpm contracts:generate &&
pnpm contracts:typecheck &&
pnpm api:lint &&
pnpm api:typecheck &&
pnpm api:test --runInBand modules/campaigns modules/authorization &&
pnpm frontend:lint &&
pnpm frontend:typecheck &&
pnpm storefront:test storefront-announcement storefront-header campaign-visibility &&
pnpm storefront:test:e2e campaign-landing.spec.ts
```

```bash
(
  cd "/Users/amirhosseinhamidian/Projects/hamidian-silver" || exit 1
  fest10_db="$(docker run -d --rm \
    -e POSTGRES_USER=hamidian -e POSTGRES_PASSWORD=fest10_local \
    -e POSTGRES_DB=hamidian_fest10_test -p 127.0.0.1::5432 postgres:18.6-alpine)" || exit 1
  trap 'docker stop "$fest10_db" >/dev/null' EXIT
  for attempt in {1..30}; do
    docker exec "$fest10_db" pg_isready -q -h 127.0.0.1 -U hamidian -d hamidian_fest10_test && break
    sleep 1
  done
  docker exec "$fest10_db" pg_isready -h 127.0.0.1 -U hamidian -d hamidian_fest10_test || exit 1
  fest10_address="$(docker port "$fest10_db" 5432/tcp)" || exit 1
  export DATABASE_URL="postgresql://hamidian:fest10_local@${fest10_address}/hamidian_fest10_test"
  pnpm db:validate &&
  pnpm exec prisma migrate deploy &&
  pnpm api:test:e2e --runInBand 'campaign-landing|campaign-lifecycle|festival-theme-library'
)
```

مدیر پروژه پاس شدن تست‌های محلی را گزارش کرد. کامیت `038f5530dd84740d80f5760ddd45e7665a59454f` روی `seo-fix` و مرجع محلی `origin/seo-fix` تأیید شد. بازبینی دستی GIF و منوی جشنواره با دادهٔ نمایندهٔ عملیاتی برای پذیرش نهایی ثبت می‌شود.
