# MAR-06 | مدیریت پیشنهاد فروش

وضعیت **IN_REVIEW** روی شاخهٔ `seo-fix` و مبنای `4a2e24698dafaa7b73ec45d1c767c872abea9bf8` است. مدیر پروژه پاس شدن تست‌های MAR-05 را گزارش کرد. [معماری اطلاعات](MAR-05.md)

از «بازاریابی و رشد ← کمپین‌ها و پیشنهادهای فروش» می‌توان پیشنهاد تازه‌ای با نام، هدف، بازهٔ تهران، محدودهٔ محصول یا دسته، گروه مشتری و سقف بودجهٔ تخفیف ذخیره کرد. پیش‌نویس بلافاصله در فهرست فروش ظاهر می‌شود و ادامهٔ آن به ویرایشگر فعلی تخفیف، کوپن، سهمیه و پیش‌نمایش می‌رسد. گرفتن تأیید، زمان‌بندی و فعال‌سازی به اعتبارسنجی Scope، قانون و بودجهٔ سمت سرور وابسته‌اند. توقف و پایان از چرخهٔ فعلی انجام می‌شوند.

جست‌وجوی نام، فیلتر وضعیت و نوع، ترتیب شروع و هم‌پوشانی بازهٔ فعالیت پیش از صفحه‌بندی اجرا می‌شوند. فهرست، انتخاب صریح محصول و دسته، سقف بودجهٔ تخفیف و تعداد محصولات دارای سهمیه را نشان می‌دهد. مصرف واقعی بودجه، سفارش‌ها و فروش دستی در مرکز عملیات عرضه می‌شوند. برای پیشنهاد مستقل، ورودی‌های بنر، لندینگ و کانال از گردش مدیریت حذف شده‌اند. تنظیم نرخ اختصاصی محصول و واریانت از قرارداد مصوب جشنواره پیروی می‌کند.

ایجاد و ویرایش با `settings.write`، خواندن فهرست با `settings.read` و دسترسی به سفارش‌ها با `orders.read` انجام می‌شوند. موتور موجود تخفیف، قیمت‌گذاری Checkout، Snapshot سفارش و ظرفیت سهمیه را محاسبه می‌کند. اتصال صریح پیشنهاد به جشنواره و گزارش مالی تجمیعی در مراحل وابسته بررسی می‌شوند.

## سازگاری داده و انتشار

مهاجرت `20261126180000_campaign_sales_purpose` یک فیلد nullable به Campaign می‌افزاید. مقدار رکوردهای قبلی خالی می‌ماند و نوع دامنه و شناسه‌های تاریخی قرارداد قبلی را دارند. پیشنهاد مستقل با نوع دامنهٔ `LEGACY` و هدف مدیریتی `SALES` ذخیره می‌شود. شناسهٔ داخلی از سمت سرور ایجاد می‌شود. شرط پایگاه داده ترکیب نوع، کانال داخلی و فیلدهای نمایش را محدود می‌کند. خواندن عمومی و Sitemap فقط رکوردهای دارای گردش لندینگ را در نظر می‌گیرند. [تصمیم MAR-02](MAR-02.md)

در انتشار، ابتدا Migration و API سازگار و سپس Admin به‌روزرسانی می‌شوند. در بازگشت مرحله‌ای، Admin پیش از API بازگردانده می‌شود و Migration افزایشی روی پایگاه داده می‌ماند. پس از ساخت اولین پیشنهاد، نسخهٔ قدیمی API فیلد هدف مدیریتی را نمی‌خواند و پیش‌نویس مستقل را کمپین قدیمی می‌بیند. MAR-17 باید پیش از انتشار راه بازگشت با API سازگار یا محدود کردن ویرایش پیشنهادهای مستقل را اعتبارسنجی کند. آزمون E2E بررسی می‌کند که API جدید لندینگ به‌جامانده از نسخهٔ قدیمی را عمومی نکند.

## تست‌های لوکال

```zsh
cd "/Users/amirhosseinhamidian/Projects/hamidian-silver" &&
DATABASE_URL='postgresql://schema:schema@127.0.0.1:5432/schema' pnpm contracts:generate &&
pnpm api:lint &&
pnpm api:typecheck &&
pnpm api:test --runInBand modules/campaigns modules/authorization modules/seo/audit &&
pnpm admin:lint &&
pnpm admin:typecheck &&
pnpm admin:test src/lib/navigation/admin-navigation.test.ts src/components/campaigns/campaign-operations-center.test.tsx src/components/campaigns/festival-wizard.test.tsx
```

بلوک زیر پایگاه دادهٔ موقت را آماده و پس از اجرا کانتینر موقت را می‌بندد.

```zsh
(
  cd "/Users/amirhosseinhamidian/Projects/hamidian-silver" || exit 1

  mar06_db="$(docker run -d --rm \
    -e POSTGRES_USER=hamidian \
    -e POSTGRES_PASSWORD=mar06_local \
    -e POSTGRES_DB=hamidian_mar06_test \
    -p 127.0.0.1::5432 postgres:18.6-alpine)" || exit 1
  trap 'docker stop "$mar06_db" >/dev/null 2>&1' EXIT

  for attempt in {1..30}; do
    docker exec "$mar06_db" pg_isready -q -h 127.0.0.1 -U hamidian -d hamidian_mar06_test && break
    sleep 1
  done
  docker exec "$mar06_db" pg_isready -h 127.0.0.1 -U hamidian -d hamidian_mar06_test || exit 1

  mar06_address="$(docker port "$mar06_db" 5432/tcp)" || exit 1
  case "$mar06_address" in
    127.0.0.1:[0-9]*) ;;
    *) exit 1 ;;
  esac
  export DATABASE_URL="postgresql://hamidian:mar06_local@${mar06_address}/hamidian_mar06_test?schema=public"

  pnpm db:generate &&
  pnpm exec prisma migrate deploy &&
  pnpm api:test:e2e --runInBand 'campaign-list|campaign-lifecycle|campaign-operations|promotion-checkout|campaign-quota'
)
```

۱. از نمای فروش پیشنهاد بسازید و به فهرست برگردید. پیش از ثبت تخفیف در فیلتر «پیشنهاد فروش مستقل» دیده شود. تغییر نام یا بودجه ذخیره شود. جست‌وجو، فیلتر و بازگشت از جزئیات به همان فهرست را بررسی کنید.

۲. برای پیشنهاد یک قانون تخفیف و در صورت نیاز سهمیه ثبت کنید. قیمت نمونه و سقف بودجه را بررسی کنید. پیشنهاد را تأیید و زمان‌بندی کنید و پس از زمان شروع، قیمت واجد شرایط و تسویهٔ Checkout را تطبیق دهید. پس از توقف، قیمت جاری و سفارش ثبت‌شده را جداگانه بررسی کنید.

۳. یک جشنواره و یک کمپین قدیمی را از لینک ذخیره‌شده باز کنید. نمای خواندنی را با دسترسی `settings.read` و ایجاد و ویرایش را با `settings.write` بررسی کنید. در عرض باریک، فرم فیلتر و انتخابگر زمان باید قابل استفاده باشند.

مدیر پروژه پاس شدن تست‌های لوکال را تأیید کرد و شروع MAR-07 را خواست. نتیجهٔ جداگانهٔ بازبینی مرورگر و SHA پذیرش هنوز ثبت نشده‌اند.
