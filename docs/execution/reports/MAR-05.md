# MAR-05 | معماری اطلاعات بازاریابی و رشد

وضعیت **IN_REVIEW** روی شاخهٔ `seo-fix` و مبنای `4a2e24698dafaa7b73ec45d1c767c872abea9bf8` است.

گروه «بازاریابی و رشد» در منوی پنل شامل «نمای کلی بازاریابی» و «گزارش‌های بازاریابی و رشد» است. نمای کلی در مسیر فعلی `/campaigns`، فهرست کامل و سه نمای جشنواره، فروش و بازاریابی را دارد. لینک ردیابی به فرم فعلی تنظیمات می‌رسد و گزارش‌ها از `/growth` و زیرمسیرهای فعلی باز می‌شوند.

| نما                        | معیار ورود                                                                                           |
| -------------------------- | ---------------------------------------------------------------------------------------------------- |
| جشنواره‌های فروش           | نوع `FESTIVAL`. کتابخانهٔ تم، ایجاد جشنواره و ادامهٔ پیش‌نویس از همین مسیر در دسترس‌اند.             |
| کمپین‌ها و پیشنهادهای فروش | رکورد غیرجشنواره‌ای با قانون تخفیف، سهمیه یا `OrderPriceQuote` مرتبط.                                |
| کمپین‌های بازاریابی        | رکورد غیرجشنواره‌ای از نوع `MARKETING` یا با مبلغ مثبت هزینهٔ برنامه‌ریزی‌شده یا ثبت‌شده برای کانال. |
| همهٔ کمپین‌ها              | همهٔ رکوردهای قبلی، شامل مواردی با شاهد ناکافی برای حضور در نماهای موضوعی.                           |

کمپین ترکیبی می‌تواند در هر دو نمای فروش و بازاریابی حضور داشته باشد. API فیلتر اختیاری `view` را پیش از صفحه‌بندی اعمال می‌کند و ترتیب و سقف قبلی فهرست را حفظ می‌کند. از فهرست فروش یا بازاریابی، لینک جزئیات و مرکز عملیات نما و شمارهٔ صفحه را همراه دارند. مراحل جشنواره و کتابخانهٔ تم مسیر بازگشت به جشنواره‌ها دارند. آدرس‌های مستقیم پیشین و شناسه‌ها معتبرند. این مرحله برای داده و موتور تخفیف همان قرارداد دامنه را به کار می‌گیرد. [ممیزی MAR-02](MAR-02.md)

فهرست و تنظیمات از `settings.read`، ساخت لینک و پیش‌نویس از `settings.write`، گزارش رشد از `finance.read` و مرکز عملیات از `orders.read` پیروی می‌کنند. ساخت پیشنهاد مستقل فروش در MAR-06 پیگیری می‌شود.

## بررسی لوکال

```bash
cd "/Users/amirhosseinhamidian/Projects/hamidian-silver" &&
pnpm contracts:generate &&
pnpm api:lint &&
pnpm api:typecheck &&
pnpm api:test --runInBand modules/campaigns modules/authorization &&
pnpm admin:lint &&
pnpm admin:typecheck &&
pnpm admin:test src/lib/navigation/admin-navigation.test.ts src/components/campaigns/campaign-operations-center.test.tsx
```

اجرای اولیهٔ E2E پیش از اتصال به PostgreSQL به‌دلیل تعریف‌نشدن `DATABASE_URL` متوقف شد. بلوک زیر PostgreSQL موقت را روی پورت آزاد لوکال بالا می‌آورد، متغیر اتصال را برای همین اجرا تعریف می‌کند، مهاجرت‌ها و تست‌ها را اجرا می‌کند و در پایان کانتینر موقت را می‌بندد.

```bash
(
  cd "/Users/amirhosseinhamidian/Projects/hamidian-silver" || exit 1

  mar05_db="$(docker run -d --rm \
    -e POSTGRES_USER=hamidian \
    -e POSTGRES_PASSWORD=mar05_local \
    -e POSTGRES_DB=hamidian_mar05_test \
    -p 127.0.0.1::5432 postgres:18.6-alpine)" || exit 1
  trap 'docker stop "$mar05_db" >/dev/null 2>&1' EXIT

  for attempt in {1..30}; do
    docker exec "$mar05_db" pg_isready -q -h 127.0.0.1 -U hamidian -d hamidian_mar05_test && break
    sleep 1
  done
  docker exec "$mar05_db" pg_isready -h 127.0.0.1 -U hamidian -d hamidian_mar05_test || exit 1

  mar05_address="$(docker port "$mar05_db" 5432/tcp)" || exit 1
  case "$mar05_address" in
    127.0.0.1:[0-9]*) ;;
    *) exit 1 ;;
  esac
  export DATABASE_URL="postgresql://hamidian:mar05_local@${mar05_address}/hamidian_mar05_test?schema=public"

  pnpm db:generate &&
  pnpm exec prisma migrate deploy &&
  pnpm api:test:e2e --runInBand 'campaign-list|campaign-lifecycle|campaign-operations'
)
```

۱. از «بازاریابی و رشد» هر نما را باز کنید. جشنواره را در نمای جشنواره و رکورد قدیمی را در فهرست کامل پیدا کنید. لینک یک مورد ذخیره‌شدهٔ قدیمی را باز کنید. از جزئیات یا فیلتر مرکز عملیات به همان نما برگردید.

۲. با دسترسی خواندن تنظیمات، نمای کلی و فهرست‌ها را بررسی کنید. ساخت پیش‌نویس و لینک ردیابی فقط با دسترسی نوشتن نمایان‌اند. حساب دارای دسترسی مالی می‌تواند گزارش رشد را از همان گروه باز کند. لینک ردیابی باید به فرم در تنظیمات برسد.

۳. در عرض باریک، دسترسی به تب‌ها و حالت انتخاب‌شده را بررسی کنید. از کتابخانهٔ تم و مراحل پیش‌نویس به فهرست جشنواره برگردید.

مدیر پروژه در ۲۶ نوامبر ۲۰۲۶ پاس شدن تست‌های لوکال را تأیید کرد و شروع MAR-06 را خواست. نتیجهٔ بازبینی جداگانهٔ مرورگر و SHA پذیرش هنوز ثبت نشده‌اند.
