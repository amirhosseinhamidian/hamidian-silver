# MAR-09 | انتخابگرهای مشترک و تقویم

وضعیت **IN_REVIEW** روی شاخهٔ `seo-fix` است. مدیر پروژه پاس شدن تست‌های لوکال MAR-08 را تأیید کرد. [گزارش MAR-08](MAR-08.md)

داشبورد رشد، گزارش جزئی کمپین و جشنواره از انتخابگر مشترک بازه استفاده می‌کنند. ثبت هزینه از همان تقویم در حالت انتخاب روز بهره می‌برد. تعویض شمسی و میلادی روز، ساعت و دقیقهٔ انتخاب‌شده را حفظ می‌کند. فرم گزارش تاریخ روز را به‌شکل `YYYY-MM-DD` می‌فرستد و API آن را بر اساس روز تهران می‌خواند. فرم زمان‌بندی همان تاریخ و ساعت شمسی را به API می‌دهد.

فرم بازاریابی، بنر کمپین، اعلان جشنواره و سازندهٔ لینک از انتخابگر مقصد مشترک استفاده می‌کنند. مقصد از صفحات اصلی، محصول، دسته، برند یا صفحهٔ فعال کمپین انتخاب می‌شود. مسیرهای دستی ویژه و پارامترهای قبلی هنگام ویرایش حفظ می‌شوند. ورود دستی همچنان طبق قواعد همان فرم در سرور بررسی می‌شود. در لینک کمپینِ دارای مقصد ثابت، نشانی ذخیره‌شده برای تولید UTM استفاده می‌شود. انتخاب صفحهٔ فعال از همان انتخابگر مجموعه است و نسخه‌های پیش‌نویس و خارج از بازه را فهرست نمی‌کند. گردش کپی قواعد مجموعهٔ هوشمند همچنان از فهرست قابل ویرایش استفاده می‌کند.

انتخابگر محصول جست‌وجوی سرور، فیلتر، صفحه‌بندی و کارت تصویری دارد و در فرم گزارش جشنواره در حالت انتخاب تکی به کار می‌رود. واریانت‌ها از کنترل انتخاب محصول و واریانت موجود در نرخ‌های اختصاصی جشنواره عرضه می‌شوند. دسته و برند از ساختار فعال کاتالوگ استفاده می‌کنند. جست‌وجوی این دو روی پاسخ طبقه‌بندی انجام می‌شود که شامل کالاهای کاتالوگ نیست. انتخابگر گزارش پس از باز شدن داده می‌گیرد. برش دستهٔ داشبورد رشد بر مبنای عضویت فعلی است و گزینه‌ها با قرارداد نشانی دستهٔ همان گزارش هماهنگ‌اند. برای دادهٔ تاریخی در جشنواره و کاربران دارای مجوز مالی بدون مجوز انتخابگر، ورودی دستی حفظ شده است.

## تست‌های لوکال

```zsh
cd "/Users/amirhosseinhamidian/Projects/hamidian-silver" &&
DATABASE_URL='postgresql://schema:schema@127.0.0.1:5432/schema' pnpm contracts:generate &&
pnpm api:lint &&
pnpm api:typecheck &&
pnpm api:test --runInBand modules/campaigns modules/growth-attribution modules/authorization &&
pnpm admin:lint &&
pnpm admin:typecheck &&
pnpm admin:test src/components/campaigns src/components/growth src/components/ui/dual-calendar-picker.test.tsx
```

```zsh
(
  cd "/Users/amirhosseinhamidian/Projects/hamidian-silver" || exit 1

  mar09_db="$(docker run -d --rm \
    -e POSTGRES_USER=hamidian \
    -e POSTGRES_PASSWORD=mar09_local \
    -e POSTGRES_DB=hamidian_mar09_test \
    -p 127.0.0.1::5432 postgres:18.6-alpine)" || exit 1
  trap 'docker stop "$mar09_db" >/dev/null 2>&1' EXIT

  for attempt in {1..30}; do
    docker exec "$mar09_db" pg_isready -q -h 127.0.0.1 -U hamidian -d hamidian_mar09_test && break
    sleep 1
  done
  docker exec "$mar09_db" pg_isready -h 127.0.0.1 -U hamidian -d hamidian_mar09_test || exit 1

  mar09_address="$(docker port "$mar09_db" 5432/tcp)" || exit 1
  case "$mar09_address" in
    127.0.0.1:[0-9]*) ;;
    *) exit 1 ;;
  esac
  export DATABASE_URL="postgresql://hamidian:mar09_local@${mar09_address}/hamidian_mar09_test?schema=public"

  pnpm db:generate &&
  pnpm exec prisma migrate deploy &&
  pnpm api:test:e2e --runInBand 'campaign-lifecycle|campaign-landing|growth-revenue'
)
```

۱. در فرم کمپین یک زمان نزدیک نیمه‌شب انتخاب کنید. بین شمسی و میلادی جابه‌جا شوید و بعد از ذخیره همان روز و ساعت را بررسی کنید. در گزارش و فرم هزینه هم روز انتخاب‌شده را با تعویض تقویم تطبیق دهید.

۲. از انتخابگر مقصد، محصول، دسته، برند و یک صفحهٔ فعال کمپین را انتخاب کنید. بین صفحات نتایج جابه‌جا شوید و انتخاب تکراری، حذف انتخاب، حفظ نشانی قبلی دارای پارامتر و نمایش ندادن پیش‌نویس در فهرست مقصد را بررسی کنید.

۳. در گزارش رشد دستهٔ فعال را انتخاب کنید و در گزارش جشنواره فیلتر محصول و مسیر دادهٔ تاریخی را بررسی کنید. رفتار حساب با مجوز مالی و حساب با دسترسی خواندن تنظیمات را جداگانه بررسی کنید.

مدیر پروژه پاس شدن تست‌های لوکال را تأیید کرد و شروع MAR-10 را خواست. نتیجهٔ جداگانهٔ بازبینی مرورگر و SHA پذیرش هنوز ثبت نشده‌اند.
