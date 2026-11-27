# MAR-07 | مدیریت کمپین بازاریابی

وضعیت **IN_REVIEW** روی شاخهٔ `seo-fix` است. پاس شدن تست‌های لوکال `MAR-06` را مدیر پروژه تأیید کرد. [گزارش MAR-06](MAR-06.md)

در «بازاریابی و رشد ← کمپین‌های بازاریابی»، فرم ساخت و ویرایش پیش‌نویس کانال، هدف تجاری، توضیحات، ابتدا و انتهای بازه به وقت تهران، مقصد و بودجهٔ تبلیغات را ثبت می‌کند. مقصد از صفحات اصلی و انتخابگر محصول، دسته و برند انتخاب می‌شود. مسیرهای عمومی دیگر، مثل مقاله یا صفحهٔ فعال کمپین، در ورودی مسیر عمومی ثبت می‌شوند. سرور اعتبار مسیر و موجودیت مقصد را هنگام ذخیره، تأیید و شروع بررسی می‌کند.

هر فعالیت می‌تواند هم‌زمان به یک جشنواره و یک پیشنهاد یا کمپین فروش مرتبط باشد. ارتباط اختیاری است و حذف آن از پیش‌نویس ممکن است. جشنوارهٔ بایگانی‌شده برای انتخاب تازه در دسترس نیست و پیوند تاریخی برای مراجعه به جزئیات باقی می‌ماند. سرور نقش هدف هر پیوند را بررسی می‌کند.

شناسهٔ UTM در زمان ساخت تولید می‌شود و ویرایش پیش‌نویس آن را حفظ می‌کند. ساخت و کپی لینک از فرم موجود با مقصد و کانال ذخیره‌شده انجام می‌شود. کانال مستقیم با نشانی مقصد استفاده می‌شود. بودجهٔ برنامه‌ریزی‌شده در جزئیات و مبلغ ثبت‌شدهٔ تبلیغات با دسترسی مالی از Growth نمایش داده می‌شوند. عنوان «ثبت نشده» برای هزینهٔ فاقد ثبت و پیام جداگانه برای خطای دریافت دارد. تنظیم مستقلی برای هدف‌گیری مخاطب پلتفرم تبلیغاتی در قرارداد فعلی وجود ندارد.

کمپین‌های قبلی با فرم و شناسهٔ موجود خوانده می‌شوند. پیشنهادهای مرتبط قواعد فروش و Snapshot سفارش خودشان را دارند. بودجهٔ تبلیغات کمپین تازه مقدار کامل بودجهٔ برنامه‌ریزی‌شده است و ظرفیت بودجهٔ تخفیف آن صفر است. مجوز نوشتن تنظیمات برای ایجاد، ویرایش و ساخت لینک و مجوز خواندن مالی برای هزینه و گزارش استفاده می‌شود.

## مهاجرت

مهاجرت افزایشی `20261126190000_marketing_campaign_settings` مقصد و دو کلید خارجی اختیاری را به Campaign اضافه می‌کند. رکوردهای قبلی مقدار خالی دارند. حذف نهایی یک رکورد مرتبط، شناسهٔ رابطه را خالی می‌کند و Snapshot نسخهٔ قبلی برای سابقه باقی می‌ماند. ترتیب بررسی انتشار Migration، API، سپس Admin است. سازگاری بازگشت مرحله‌ای با دادهٔ تازه در MAR-17 بررسی می‌شود.

## تست‌های لوکال

```zsh
cd "/Users/amirhosseinhamidian/Projects/hamidian-silver" &&
DATABASE_URL='postgresql://schema:schema@127.0.0.1:5432/schema' pnpm contracts:generate &&
pnpm api:lint &&
pnpm api:typecheck &&
pnpm api:test --runInBand modules/campaigns modules/growth-attribution modules/promotions modules/authorization &&
pnpm admin:lint &&
pnpm admin:typecheck &&
pnpm admin:test src/components/campaigns src/lib/navigation/admin-navigation.test.ts
```

```zsh
(
  cd "/Users/amirhosseinhamidian/Projects/hamidian-silver" || exit 1

  mar07_db="$(docker run -d --rm \
    -e POSTGRES_USER=hamidian \
    -e POSTGRES_PASSWORD=mar07_local \
    -e POSTGRES_DB=hamidian_mar07_test \
    -p 127.0.0.1::5432 postgres:18.6-alpine)" || exit 1
  trap 'docker stop "$mar07_db" >/dev/null 2>&1' EXIT

  for attempt in {1..30}; do
    docker exec "$mar07_db" pg_isready -q -h 127.0.0.1 -U hamidian -d hamidian_mar07_test && break
    sleep 1
  done
  docker exec "$mar07_db" pg_isready -h 127.0.0.1 -U hamidian -d hamidian_mar07_test || exit 1

  mar07_address="$(docker port "$mar07_db" 5432/tcp)" || exit 1
  case "$mar07_address" in
    127.0.0.1:[0-9]*) ;;
    *) exit 1 ;;
  esac
  export DATABASE_URL="postgresql://hamidian:mar07_local@${mar07_address}/hamidian_mar07_test?schema=public"

  pnpm db:generate &&
  pnpm exec prisma migrate deploy &&
  pnpm api:test:e2e --runInBand 'campaign-list|campaign-lifecycle|campaign-operations|growth-revenue'
)
```

در پنل یک کمپین ارگانیک با مقصد فعال و هر دو ارتباط بسازید. یکی از ارتباط‌ها را حذف و با شناسهٔ UTM قبلی لینک جدید بسازید. سپس کانال مستقیم، مسیر نامعتبر، حساب بدون مجوز مالی و کمپین بازاریابی قدیمی را بررسی کنید. در گزارش Growth با یک ثبت هزینهٔ آزمایشی، مبلغ ثبت‌شده را از بودجهٔ برنامه‌ریزی‌شده تطبیق دهید.

مدیر پروژه پاس شدن تست‌های لوکال را تأیید کرد و شروع MAR-08 را خواست. نتیجهٔ جداگانهٔ بازبینی مرورگر و SHA پذیرش هنوز ثبت نشده‌اند.
