# VPS-001 — Docker imageهای production

هر سه image از ریشهٔ monorepo ساخته می‌شوند. فعلاً VPS، دامنه، اتصال دیتابیس یا secret واقعی لازم نیست.
دستورهای زیر فقط نمونهٔ بررسی محلی هستند؛ آدرس نمونهٔ رسانه برای استقرار واقعی مناسب نیست.

```bash
docker build -f apps/api/Dockerfile --target runtime -t hamidian-api:vps001 .
docker build -f apps/api/Dockerfile --target migrate -t hamidian-api-migrate:vps001 .
docker build -f apps/storefront/Dockerfile \
  --build-arg MEDIA_PUBLIC_BASE_URL=https://media.example.com/media \
  -t hamidian-storefront:vps001 .
docker build -f apps/admin/Dockerfile -t hamidian-admin:vps001 .
```

`MEDIA_PUBLIC_BASE_URL` در زمان ساخت Storefront باید برابر آدرس عمومی نهایی رسانه باشد؛
Next.js فهرست hostهای مجاز تصویر را هنگام build در خروجی قرار می‌دهد. مقدار runtime این متغیر نیز
باید با مقدار build یکسان بماند. اگر بعداً آدرس رسانه تغییر کند، Storefront باید دوباره build شود.
برای فعال‌سازی Analytics، `NEXT_PUBLIC_GA_MEASUREMENT_ID` را هنگام build با `--build-arg` بدهید؛
برای لینک پیش‌نمایش محتوا در Admin، `NEXT_PUBLIC_STOREFRONT_URL` هم یک build arg عمومی است.
هیچ رمز یا tokenی نباید با `--build-arg` یا داخل image منتقل شود.

- API در مسیر `dist/main.js` با کاربر غیر root اجرا می‌شود و پورت داخلی پیش‌فرض آن `3000` است.
  در زمان اجرا `DATABASE_URL`، `OTP_PEPPER`، `MEDIA_PUBLIC_BASE_URL`،
  `MEDIA_STORAGE_ROOT` و دیگر تنظیمات سرویس باید بیرون از image ارائه شوند.
- Storefront و Admin از خروجی مستقل `standalone` با کاربر غیر root اجرا می‌شوند؛
  پورت داخلی هر دو `3000` است و در Compose/Nginx از هم تفکیک خواهند شد.
- target جداگانهٔ `migrate` فقط برای job کنترل‌شدهٔ استقرار است. **هرگز** migration را
  در startup اپلیکیشن اجرا نکنید. روی VPS فقط `prisma migrate deploy` مجاز است.
- `.dockerignore` از ورود فایل‌های env، کلیدها، دادهٔ media، خروجی build محلی و فایل‌های
  آزمایش به context ساخت جلوگیری می‌کند. برای media باید در VPS-006 مسیر ماندگار
  `/var/lib/hamidian-silver/media` به API mount شود؛ داده داخل کانتینر پایدار نیست.

Compose production، healthcheck مسیر `/api/v1/health/ready`، اتصال داخلی PostgreSQL/Redis،
متغیرهای runtime و ترتیب اجرای migrator در VPS-002 و مراحل بعد پیاده‌سازی می‌شوند.
