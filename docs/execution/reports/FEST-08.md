# FEST-08 | پیش‌نمایش خصوصی جشنواره

وضعیت `DONE` روی `seo-fix`. پس از ثبت اولیهٔ لندینگ، دکمهٔ «باز کردن پیش‌نمایش زنده» در مرحلهٔ صفحه و مجموعه در دسترس است. پنجرهٔ پیش‌نمایش با برچسب «پیش‌نمایش خصوصی» از پنل باز می‌شود و چهار حالت دسکتاپ، تبلت، موبایل و تمام‌صفحه دارد. حالت تمام‌صفحه در مرورگرهای دارای Fullscreen API از تمام صفحه استفاده می‌کند و در مرورگرهای دیگر به عرض پنجره می‌رسد. سازوکار هم‌مبدأ `frame-ancestors 'self'` برای فروشگاه برقرار است و قاب در پنجرهٔ فروشگاه باز می‌شود.

تغییر هر دو فرم، پس از مکث کوتاه، درخواست قبلی را لغو می‌کند و آخرین طرح معتبر را به همان قاب می‌فرستد. پیش‌نمایش لندینگ، Hero، کارت، سکشن‌ها، تایمر، منو و اعلان از اجزای واقعی فروشگاه استفاده می‌کند. قواعد ثبت‌شدهٔ تخفیف و سهمیهٔ همان جشنواره و کالاهای واجد شرایط از مسیر خواندنی کاتالوگ می‌آیند. پیش‌نمایش نمونهٔ اول فهرست کامل را نشان می‌دهد. سکشن‌ها و جایگاه‌های فعالِ فرم برای بازبینی ظاهر صرف‌نظر از زمان‌بندی عمومی دیده می‌شوند. ذخیره، انتشار و بازگردانی نسخه در کنترل‌های فعلی قرار دارند.

API داده فقط از نشست پنل و مجوز `settings.read` استفاده می‌کند و با `private, no-store` پاسخ می‌دهد. پیام‌ها به پنجره و مبدأ دقیق و شناسهٔ تصادفی همان جلسه محدودند. صفحه و قاب عمومی فقط پوسته را ارائه می‌کنند و داده از URL یا Cache عمومی خوانده نمی‌شود. پاسخ HTML پوسته در اجرای تولید `no-store` دارد. `next dev` برای همین HTML هدر `no-cache, must-revalidate` می‌فرستد. در هر دو حالت پوسته با `noindex, nofollow` پاسخ می‌دهد. قاب حرکت بین سکشن‌ها و منوی موبایل را می‌پذیرد و پیوندهای خروجی، حساب، خرید و علاقه‌مندی در آن عملیاتی نیستند. کدهای Analytics و Attribution روی مسیر پیش‌نمایش بارگذاری نمی‌شوند.

پیش‌فرض توسعه `http://localhost:3002` برای پنل و `http://localhost:3001` برای فروشگاه است. برای نشانی متفاوت، `ADMIN_APP_ORIGIN` را در فرایند فروشگاه و `NEXT_PUBLIC_STOREFRONT_URL` را در فرایند پنل با مبدأ دقیق تنظیم کنید. Compose مبدأ پنل هر محیط را به فروشگاه می‌دهد. این مرحله Migration تازه ندارد.

## بررسی محلی

E2E پایگاه داده پیش‌نمایش تنظیمات ذخیره‌نشده، رنگ تم در منو، قیمت و سهمیه و استقلال نسخهٔ ذخیره‌شده را بررسی می‌کند. Playwright دسترسی به پوسته بدون داده، تطبیق شناسه، به‌روزرسانی بدون باز کردن پنجرهٔ تازه، اندازه‌ها و بی‌اثر بودن دکمهٔ خروجی را می‌سنجد.

```bash
cd "/Users/amirhosseinhamidian/Projects/hamidian-silver" &&
DATABASE_URL='postgresql://schema:schema@127.0.0.1:5432/schema' pnpm contracts:generate &&
pnpm contracts:typecheck &&
pnpm api:lint &&
pnpm api:typecheck &&
pnpm api:test --runInBand modules/campaigns modules/promotions modules/catalog modules/authorization &&
pnpm frontend:lint &&
pnpm frontend:typecheck &&
pnpm admin:test festival-designer festival-theme-library &&
pnpm storefront:test storefront-header storefront-announcement catalog-product-card &&
pnpm storefront:test:e2e festival-preview.spec.ts campaign-landing.spec.ts
```

```bash
(
  cd "/Users/amirhosseinhamidian/Projects/hamidian-silver" || exit 1
  fest08_db="$(docker run -d --rm \
    -e POSTGRES_USER=hamidian -e POSTGRES_PASSWORD=fest08_local \
    -e POSTGRES_DB=hamidian_fest08_test -p 127.0.0.1::5432 postgres:18.6-alpine)" || exit 1
  trap 'docker stop "$fest08_db" >/dev/null' EXIT
  for attempt in {1..30}; do
    docker exec "$fest08_db" pg_isready -q -h 127.0.0.1 -U hamidian -d hamidian_fest08_test && break
    sleep 1
  done
  docker exec "$fest08_db" pg_isready -h 127.0.0.1 -U hamidian -d hamidian_fest08_test || exit 1
  fest08_address="$(docker port "$fest08_db" 5432/tcp)" || exit 1
  export DATABASE_URL="postgresql://hamidian:fest08_local@${fest08_address}/hamidian_fest08_test"
  pnpm exec prisma migrate deploy &&
  pnpm api:test:e2e --runInBand 'campaign-landing|campaign-lifecycle|festival-theme-library'
)
```

مدیر پروژه پاس شدن تست‌های محلی را گزارش کرد. کامیت `d78ff578e94588987b58c3f78501c3c3fb0cfa83` روی شاخهٔ `seo-fix` و مرجع محلی `origin/seo-fix` تأیید شد. بازبینی با دادهٔ نمایندهٔ محیط عملیاتی در پذیرش نهایی ثبت می‌شود.
