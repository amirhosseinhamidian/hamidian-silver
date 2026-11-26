# SEO-07 — ممیزی فنی خودکار سئو

وضعیت `IN_REVIEW` است. پیاده‌سازی از کامیت `b69a0c6990b2ace8931262daab98ee6961856008` روی `seo-fix` آغاز شد.

## نمونه‌برداری و شواهد

- نمونه از صفحه‌های اصلی، محصولات فعال، دسته‌ها، برندها، مقاله‌های منتشرشده و لندینگ‌های فعال ساخته می‌شود. در هر گروه صفحات تازه‌تر اولویت دارند. Sitemap واقعی، لینک‌های HTML و لینک‌های صفحه‌بندی نمونه را تکمیل می‌کنند.
- هر اجرا حداکثر ۴۰ آدرس شامل Sitemap، در نوبت‌های سه‌تایی بررسی می‌کند. درخواست‌ها پشت‌سرهم با فاصلهٔ حداقل ۵۰۰ میلی‌ثانیه، مهلت ۴ ثانیه و حداکثر سه Redirect دنبال‌شده ارسال می‌شوند. API فقط Origin عمومی تنظیم‌شده و مسیرهای عمومی شناخته‌شده را می‌پذیرد. پاسخ HTML حداکثر ۲ مگابایت و Sitemap حداکثر ۳ مگابایت خوانده می‌شوند. نسخهٔ فعلی قالب `urlset` فروشگاه را می‌خواند.
- وضعیت HTTP، زنجیرهٔ Redirect، Canonical، دستورهای Robots، عنوان، توضیح متا و نوع JSON-LD ثبت می‌شوند. پاسخ ۴۰۴ محصول فقط وقتی به‌عنوان خطای محصول دارای موجودی ثبت می‌شود که موجودی قابل تسویه در همان زمان تأیید شود. قواعد لندینگ جشنواره، صفحه‌بندی، فیلتر و دو Redirect تاریخی SEO-02 در نمونه لحاظ شده‌اند.
- تشابه بر اساس تطابق عنوان و توضیح متای نرمال‌شده و عمق بر اساس کوتاه‌ترین مسیر دیده‌شده روی لینک‌های نمونه محاسبه می‌شود. این دو یافته برای بازبینی‌اند. خطاهای شبکه یا پاسخ نامعتبر وضعیت قابل تأیید تولید نمی‌کنند و به‌عنوان نیازمند بازبینی ثبت می‌شوند. شمارهٔ نسخهٔ قواعد، وضعیت جدید یا مشاهده‌شده و شواهد هر یافته در تاریخچه ثبت می‌شوند.
- PostgreSQL نتایج هر آدرس و اجارهٔ موقت Worker را نگه می‌دارد. پس از توقف API، نوبت بعدی کار ناتمام را بعد از انقضای اجاره ادامه می‌دهد. شکست گذرای شبکه یا سرویس حداکثر سه تلاش دارد. دریافت ۴۲۹ یا ۵۰۳ کل همان ممیزی را یک دقیقه مکث می‌دهد.
- صفحهٔ «عملکرد جست‌وجو ← مشکلات فنی سئو» با دسترسی `settings.read` گزارش و ده اجرای اخیر را نشان می‌دهد. ثبت اجرای دستی به `settings.write` نیاز دارد. در API، `STOREFRONT_PUBLIC_ORIGIN` باید به فروشگاه مورد بررسی اشاره کند. `SEO_AUDIT_ENABLED=true` ثبت خودکار ممیزی حداکثر هر ۲۴ ساعت را فعال می‌کند و مقدار پیش‌فرض خاموش است.

## بررسی محلی

آزمون‌ها و بیلد در انتظار اجرای مدیر پروژه‌اند. CI، تطبیق زندهٔ Search Console مربوط به SEO-04 و بررسی پس از انتشار در مرحلهٔ انتشار پیگیری می‌شوند. سناریوی E2E قدیمی SEO-04 در فرمان پایگاه داده گنجانده شده است.

از ریشهٔ پروژه:

```bash
cd "/Users/amirhosseinhamidian/Projects/hamidian-silver" &&
pnpm install --frozen-lockfile &&
pnpm contracts:generate &&
pnpm api:lint &&
pnpm api:typecheck &&
pnpm api:test --runInBand modules/seo modules/authorization &&
pnpm frontend:lint &&
pnpm frontend:typecheck &&
pnpm frontend:test &&
pnpm storefront:test:e2e guide-seo.spec.ts catalog-facets.spec.ts festival-preview.spec.ts
```

برای Migration و E2E از PostgreSQL موقت استفاده کنید. Docker یک پورت آزاد روی Loopback انتخاب می‌کند.

```bash
(
  cd "/Users/amirhosseinhamidian/Projects/hamidian-silver" || exit 1
  seo07_db="$(docker run -d --rm \
    -e POSTGRES_USER=hamidian -e POSTGRES_PASSWORD=seo07_e2e_local \
    -e POSTGRES_DB=hamidian_seo07_test -p 127.0.0.1::5432 postgres:18.6-alpine)" || exit 1
  trap 'docker stop "$seo07_db" >/dev/null 2>&1' EXIT
  for attempt in {1..30}; do
    docker exec "$seo07_db" pg_isready -q -h 127.0.0.1 -U hamidian -d hamidian_seo07_test && break
    sleep 1
  done
  docker exec "$seo07_db" pg_isready -h 127.0.0.1 -U hamidian -d hamidian_seo07_test || exit 1
  seo07_address="$(docker port "$seo07_db" 5432/tcp)" || exit 1
  case "$seo07_address" in 127.0.0.1:[0-9]*) ;; *) exit 1 ;; esac
  export DATABASE_URL="postgresql://hamidian:seo07_e2e_local@${seo07_address}/hamidian_seo07_test?schema=public"

  pnpm db:generate &&
  pnpm exec prisma migrate deploy &&
  pnpm api:test:e2e --runInBand 'seo-technical-audit|search-console-sync'
)
```

برای بررسی دستی پنل، بعد از اعمال Migration روی دیتابیس لوکال، فروشگاه و API را با Origin همان فروشگاه محلی اجرا کنید. از «مشکلات فنی سئو» ممیزی را ثبت کنید. پس از پایان اجرا، گزارش را به‌روزرسانی کنید و دادهٔ HTTP، Canonical، Robots و زنجیرهٔ Redirect را با صفحات نمونه تطبیق دهید. اجرای دوم باید یافتهٔ تکراری را «مشاهده‌شده در اجرای پیشین» نشان دهد.

## انتشار و بازگشت

مهاجرت `20261126140000_seo_technical_audit` دو جدول و ایندکس‌های آن‌ها را اضافه می‌کند. ابتدا Migration و سپس API و پنل جدید منتشر می‌شوند. در بازگشت، زمان‌بندی خودکار را خاموش و نسخهٔ پیشین API و پنل را با همان دیتابیس اجرا کنید. تاریخچه برای فعال‌سازی دوباره در جدول‌ها باقی می‌ماند. بار ممیزی روی VPS در بررسی انتشار اندازه‌گیری می‌شود.
