# MAR-18 | آزمون یکپارچگی و رگرسیون

وضعیت **DONE** روی شاخهٔ `seo-fix` است. آزمون سازگاری محلی [MAR-17](MAR-17.md) پیش‌نیاز این مرحله است و مدیر پروژه نتیجهٔ موفق آن را ارائه کرد. مدیر پروژه در ۲۰۲۶-۱۱-۲۷ پذیرش محلی این مرحله را اعلام کرد. لاگ جداگانهٔ فرمان‌ها و جزئیات بازبینی دستی همراه تأیید ارائه نشد.

## پوشش رگرسیون

| سناریو                                                                                 | شواهد و پوشش                                                                                                                                                                   |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| فهرست فروش و بازاریابی، کمپین‌های مختلط و قدیمی، عملیات و انتشار جشنواره               | API در `campaign-list`، `campaign-operations` و `campaign-lifecycle`. تفکیک جریان‌های ایجاد و ویرایش و دیده‌نشدن لندینگ در پیشنهاد مستقل در بازبینی پنل.                       |
| تقویم، انتخاب کاتالوگ و لینک انتساب                                                    | پوشش موجود پنل در فرم‌های کمپین، تقویم و سازندهٔ لینک. به آزمون `campaign-list.e2e-spec.ts` بازیابی انتخاب از صفحات مختلف و جست‌وجوی ۵۰۵ محصول فعال با حذف پیش‌نویس افزوده شد. |
| قیمت پیش‌فرض و واریانت، Checkout، کیف پول، فروش دستی و مرجوعی                          | API در `promotion-checkout`، `campaign-quota`، `wallet-checkout`، `wallet-ledger` و `purchase-reward-jobs`. جریان‌های مرورگر `purchase-flow` و `wallet`.                       |
| انتساب، بازه‌های مساوی، فیلترها، عدم شمارش تکراری و جدایی هزینهٔ رسانه از بودجهٔ تخفیف | API در `growth-dashboard`، `growth-revenue` و `growth-attribution`. آزمون مسیر CSV پنل به همسانی فیلتر و صفحه، رد دسترسی و خرابی API می‌پردازد.                                |
| مجوز مدیریت، عملیات و خروجی مالی                                                       | `app.e2e-spec.ts` مسیرهای واقعی کمپین، مرکز عملیات، لینک انتساب و گزارش رشد را با مجوزهای مستقل بررسی می‌کند.                                                                  |
| پیش‌نمایش، کتابخانهٔ تم، SEO، لینک‌های عمومی و نمایش واکنش‌گرا                         | `festival-theme-library` و `campaign-landing` در API و `festival-preview`، `campaign-landing`، `catalog-facets`، `catalog-seo`، `guide-seo` و `accessibility` در Playwright.   |

در صورت تکرار پارامترها، CSV اکنون مانند گزارش پنل از نخستین مقدار استفاده می‌کند. پاسخ خطای خروجی نیز با `private, no-store` برمی‌گردد. در این مرحله قرارداد OpenAPI و مدل داده ثابت‌اند.

## اجرای لوکال

بلوک اول نسخهٔ فعلی قراردادهای تولیدشده را پیش از بازتولید کپی می‌کند تا اختلاف با همان نسخه در Working Tree سنجیده شود. Docker یک دیتابیس موقت با پورت آزاد خودکار فراهم می‌کند. Jest API برای استفادهٔ مستقل از همان دیتابیس، سری اجرا می‌شود.

```zsh
(
  set -e
  set -o pipefail
  cd "/Users/amirhosseinhamidian/Projects/hamidian-silver"

  mar18_temp="$(mktemp -d "${TMPDIR:-/tmp}/hamidian-mar18.XXXXXX")"
  mar18_pg=''
  trap 'if [ -n "$mar18_pg" ]; then docker stop "$mar18_pg" >/dev/null || true; fi; rm -r "$mar18_temp"' EXIT
  cp packages/contracts/openapi.json "$mar18_temp/openapi.json"
  cp packages/contracts/src/schema.ts "$mar18_temp/schema.ts"

  mar18_pg="$(docker run --rm -d -p 127.0.0.1::5432 \
    -e POSTGRES_USER=mar18 -e POSTGRES_PASSWORD=mar18_test_only \
    -e POSTGRES_DB=hamidian_mar18 postgres:18.6-alpine)"
  mar18_ready=''
  for mar18_attempt in $(seq 1 60); do
    if docker exec "$mar18_pg" pg_isready -h 127.0.0.1 -U mar18 -d hamidian_mar18 >/dev/null; then
      mar18_ready=1
      break
    fi
    sleep 1
  done
  test -n "$mar18_ready" || { docker logs "$mar18_pg"; exit 1; }
  mar18_port="$(docker port "$mar18_pg" 5432/tcp | awk -F: 'NR == 1 {print $NF}')"
  test -n "$mar18_port"

  export DATABASE_URL="postgresql://mar18:mar18_test_only@127.0.0.1:${mar18_port}/hamidian_mar18?schema=public"
  export OTP_PEPPER='mar18-local-test-only-pepper-123456'
  export SMS_PROVIDER=disabled PAYMENT_PROVIDER=disabled SHIPPING_PROVIDER=disabled
  export STOCK_NOTIFICATIONS_ENABLED=false SEARCH_CONSOLE_SYNC_ENABLED=false
  export TELEGRAM_BOT_TOKEN='' TELEGRAM_RELAY_URL='' TELEGRAM_RELAY_SECRET='' BALE_BOT_TOKEN=''

  pnpm db:validate
  pnpm exec prisma migrate deploy
  pnpm exec prisma migrate status
  pnpm db:generate
  pnpm contracts:generate
  diff -u "$mar18_temp/openapi.json" packages/contracts/openapi.json
  diff -u "$mar18_temp/schema.ts" packages/contracts/src/schema.ts
  pnpm verify:contracts
  pnpm verify:frontend
  pnpm api:typecheck
  pnpm api:test --runInBand
  pnpm api:test:e2e --runInBand
  pnpm api:build
  pnpm api:lint
)
```

اگر تولید قرارداد اختلاف نشان داد، نتیجهٔ `diff` را پیش از ادامه برای بررسی بفرستید. در اجرای مرورگر، پورت‌های ۴۳۱۰ و ۴۳۱۱ برای فروشگاه و API آزمایشی تنظیم شده‌اند.

بررسی قالب‌بندی سراسری، خطای نحوی تعریف ایمیج PostgreSQL در گردش‌کار GitHub Actions و اختلاف قالب‌بندی در اسناد اجرایی موجود را نشان داد. تعریف ایمیج در این مرحله اصلاح شد. پیگیری قالب‌بندی اسناد در [MAR-19](MAR-19.md) ثبت شده است. بلوک بالا قالب‌بندی فرانت‌اند را از طریق `verify:frontend` بررسی می‌کند.

```zsh
cd "/Users/amirhosseinhamidian/Projects/hamidian-silver" &&
pnpm storefront:test:e2e
```

## بازبینی دستی مرورگر

۱. در پنل آزمایشی، یک پیشنهاد فروش بسازید و ویرایش کنید. پس از جابه‌جایی بین تقویم‌ها، تاریخ تهران را بررسی کنید. محصول را با تصویر، جست‌وجو و فیلتر پیدا کنید. دو محصول را از صفحات مختلف انتخاب کنید و با تغییر فیلتر یا بازخوانی فرم از حفظ انتخاب‌ها مطمئن شوید. در کاتالوگ پرحجم این مسیر را با صفحه‌ای دورتر هم بررسی کنید.

۲. کمپین بازاریابی را با و بدون لینک بسازید. یک لینک با مقصد داخلی تولید کنید و پارامترهای انتساب را پس از باز شدن مقصد بررسی کنید. در پیشنهاد فروش مستقل مسیر ویرایش لندینگ نباید در دسترس باشد.

۳. در مرکز عملیات، فروش دستی و فروش ثبت‌شدهٔ سایت را کنار ماندهٔ سهمیه بررسی کنید. در رشد، همان بازه، فیلترها و صفحه را در داشبورد و CSV تطبیق دهید. یک بازهٔ بدون داده و یک خطای خواندن API را هم امتحان کنید. با حساب فاقد مجوز مالی، گزارش و CSV باید مسدود باشند.

۴. مسیرهای پنل و فروشگاه را در عرض‌های ۳۹۰، ۷۶۸ و ۱۴۴۰ پیکسل بررسی کنید. جهت RTL، پیمایش با Tab، بازگشت فوکوس از پنجرهٔ انتخابگر، متن خطا و نبود اسکرول افقی صفحه را بررسی کنید. اسکرول داخلی جدول در صورت نیاز قابل استفاده بماند.

۵. با یک پیش‌نویس جشنواره، تم کتابخانه، پیش‌نمایش، کارت، نوار اعلان و منو را بررسی کنید. پس از انتشار آزمایشی، قرارداد فعلی `noindex` و Canonical جشنواره و عدم نمایش بنر پیشنهاد مستقل روی صفحهٔ اصلی را کنترل کنید. در Checkout قیمت کارت و واریانت، مبلغ نهایی، اعتبار کیف پول و تخفیف را با سناریوی همان سفارش تطبیق دهید.

پذیرش محلی در [پروندهٔ نسخهٔ کاندید](MAR-19.md) ثبت شده است.
