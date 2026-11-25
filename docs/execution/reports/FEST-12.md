# FEST-12 | پذیرش قیمت، بودجه، سهمیه و Checkout جشنواره

وضعیت `DONE` روی `seo-fix` با پایهٔ `84605e0`. مدیر پروژه پاس شدن آزمون‌های محلی را گزارش کرد. کامیت `1f67b397f752fa24aa33c700cb1a1329d3876280` روی شاخه و مرجع محلی `origin/seo-fix` تأیید شد. پیش‌نیازها `FEST-02`، `FEST-09` و `FEST-11` هستند.

- تست سهمیه، جشنواره را از طریق سرویس ایجاد می‌کند، قانون و سهمیهٔ پیش‌نویس را ذخیره می‌کند و از مسیر تأیید و انتشار فوری می‌گذرد. سپس قیمت مستقل کارت لندینگ و واریانت را با Quote تطبیق می‌دهد. با رقابت برای آخرین سهمیه، یک رزرو موجودی و یک سفارش ایجاد می‌شود و تخفیف از لندینگ و صفحهٔ محصول حذف می‌شود.
- هنگام رزرو، افزایش قیمت واریانت و سپس تلاش دوبارهٔ پرداخت آزموده می‌شود. مبلغ و قانون Snapshot سفارش و قیمت جدیدِ محدودشده به بودجهٔ باقیمانده جداگانه با Checkout تطبیق داده می‌شوند. پاسخ مبهم درگاه، شکست قطعی، رد رسید تکراری، Callback تکراری، لغو، انقضا، مرجوعی و فروش دستی با قواعد فعلی سنجیده می‌شوند.
- تست کیف پول از جشنوارهٔ منتشرشده برای سنجش تفکیک تخفیف کمپین، کیف پول و مبلغ نقدی، مصرف یک‌باره، مرجوعی جزئی و بازپرداخت کامل استفاده می‌کند. تست مستقل پروموشن همچنان رقابت بودجه، کوپن، تغییر Quote، تک‌واریانت و قیمت محصول را پوشش می‌دهد.
- کار این مرحله به پذیرش قراردادهای فروش محدود است. موتور فعلی قیمت، پرداخت، موجودی و کیف پول، مسیرهای URL و متادیتای SEO لندینگ مبنای آزمون‌اند. سناریوی درگاه با بدل کنترل‌شده اجرا می‌شود. بررسی درگاه واقعی و دادهٔ جشنوارهٔ عملیاتی به پذیرش نهایی مربوط است.

## اجرای محلی

بلوک PostgreSQL روی یک پورت آزاد لوکال اجرا می‌شود و فقط کانتینر آزمایشی خودش را جمع می‌کند.

```bash
(
  cd "/Users/amirhosseinhamidian/Projects/hamidian-silver" || exit 1
  fest12_db="$(docker run -d --rm \
    -e POSTGRES_USER=hamidian -e POSTGRES_PASSWORD=fest12_local \
    -e POSTGRES_DB=hamidian_fest12_test -p 127.0.0.1::5432 postgres:18.6-alpine)" || exit 1
  trap 'docker stop "$fest12_db" >/dev/null' EXIT
  for attempt in {1..30}; do
    docker exec "$fest12_db" pg_isready -q -h 127.0.0.1 -U hamidian -d hamidian_fest12_test && break
    sleep 1
  done
  docker exec "$fest12_db" pg_isready -h 127.0.0.1 -U hamidian -d hamidian_fest12_test || exit 1
  fest12_address="$(docker port "$fest12_db" 5432/tcp)" || exit 1
  export DATABASE_URL="postgresql://hamidian:fest12_local@${fest12_address}/hamidian_fest12_test"
  pnpm db:generate &&
  pnpm exec prisma migrate deploy &&
  pnpm api:test:e2e --runInBand 'campaign-quota|promotion-checkout|wallet-checkout|campaign-operations|campaign-lifecycle'
)
```

```bash
cd "/Users/amirhosseinhamidian/Projects/hamidian-silver" &&
pnpm storefront:test:e2e campaign-landing.spec.ts purchase-flow.spec.ts wallet.spec.ts
```

در اجرای اول PostgreSQL، چهار مجموعه پاس شدند. تست سهمیه در ساخت دادهٔ کارت‌به‌کارت به‌دلیل تداخل نام شمارهٔ کارت و شیء کارت محصول شکست خورد. نام‌ها در تست اصلاح شدند و مدیر پروژه موفقیت اجرای مجدد را گزارش کرد. CI شاخهٔ `seo-fix` در گردش فعلی اجرا نمی‌شود.
