# VPS-002 — Compose محیط production

`compose.yaml` همچنان فقط مخصوص توسعه است. فایل `compose.production.yaml` سرویس‌های
PostgreSQL، Redis، API، Storefront و Admin را روی یک VPS اجرا می‌کند. این مرحله
سرور را به اینترنت منتشر نمی‌کند؛ Nginx و TLS در VPS-003/004 اضافه می‌شوند.

- PostgreSQL و Redis هیچ `ports` عمومی یا loopback ندارند و تنها از طریق شبکهٔ
  داخلی Compose با نام سرویس‌های `postgres` و `redis` در دسترس هستند. دادهٔ هر دو
  در volume محلی همان VPS باقی می‌ماند.
- فقط پورت‌های `3100` (API)، `3101` (فروشگاه) و `3102` (ادمین) روی
  `127.0.0.1` میزبان bind می‌شوند. Nginx نصب‌شده روی خود VPS بعداً به همین
  آدرس‌ها وصل می‌شود؛ هرگز این bindها را به `0.0.0.0` تغییر ندهید.
- API فقط بعد از healthy شدن دیتابیس و Redis شروع می‌شود؛ صفحه‌های Next نیز
  پس از ready شدن API شروع می‌شوند. healthcheck API به
  `/api/v1/health/ready` متصل است (و دیتابیس را می‌سنجد). `/api/health` در دو
  اپ Next فقط زنده‌بودن همان سرور Next را می‌سنجد؛ جای پایش جریان خرید نیست.
- restart سرویس‌های دائمی `unless-stopped` است، خروجی job migration هرگز restart
  نمی‌شود، و logهای کانتینر اندازهٔ محدود دارند.
- media روی میزبان در `/var/lib/hamidian-silver/media` می‌ماند؛ عمداً از
  `create_host_path: false` استفاده شده تا یک پوشهٔ اشتباهی root-owned بی‌صدا
  ساخته نشود. بکاپ‌های محلیِ قابل دانلود مربوط به VPS-007 هستند و داخل volume
  رسانه یا کانتینر قرار نمی‌گیرند.

## پیش‌نیاز اجرای آزمایشی روی VPS

این فایل هیچ رمز واقعی ندارد. پس از آماده‌شدن دسترسی امن به سرور و نصب Docker
Compose، فایل env خصوصی را فقط روی سرور و **خارج از Git** بسازید:

```bash
sudo install -d -m 0700 /etc/hamidian-silver
sudo install -m 0600 deploy/production.env.example /etc/hamidian-silver/production.env
sudo install -d -o 1000 -g 1000 -m 0750 /var/lib/hamidian-silver/media
```

در فایل خصوصی دست‌کم `POSTGRES_PASSWORD`، `DATABASE_URL` و `OTP_PEPPER` را
مقداردهی کنید. host دیتابیس در `DATABASE_URL` باید `postgres`، نه `localhost`
باشد. رمز PostgreSQL در URL باید با `POSTGRES_PASSWORD` یکسان باشد؛ کاراکترهای
ویژهٔ رمز در URL نیازمند percent-encoding هستند. `OTP_PEPPER` مستقل از رمز root
VPS و حداقل ۳۲ کاراکتر باشد. مقادیر env، خروجی کامل `docker compose config` و
کلیدهای پرداخت/SMS را در گفتگو، issue یا Git منتشر نکنید. پیکربندی محرمانهٔ
واقعی به صورت کامل در VPS-005 نهایی می‌شود.

نمونهٔ ترتیب اجرا **بعد از تکمیل پیش‌نیازها** از ریشهٔ پروژه:

```bash
sudo docker compose --env-file /etc/hamidian-silver/production.env -f compose.production.yaml config --quiet
sudo docker compose --env-file /etc/hamidian-silver/production.env -f compose.production.yaml up -d postgres redis
sudo docker compose --env-file /etc/hamidian-silver/production.env -f compose.production.yaml build migrate
sudo docker compose --env-file /etc/hamidian-silver/production.env -f compose.production.yaml run --rm migrate
sudo docker compose --env-file /etc/hamidian-silver/production.env -f compose.production.yaml build api storefront admin
sudo docker compose --env-file /etc/hamidian-silver/production.env -f compose.production.yaml up -d --no-build api storefront admin
sudo docker compose --env-file /etc/hamidian-silver/production.env -f compose.production.yaml ps
```

`migrate` یک سرویس profileدار است: اجرای `up -d` به‌تنهایی migration را اجرا
نمی‌کند. فقط target مشخص‌شدهٔ Dockerfile با `prisma migrate deploy` فراخوانی
می‌شود؛ از `prisma migrate dev` روی VPS استفاده نکنید. قبل از هر انتشارِ
شامل migration، job را جداگانه و با بررسی خروجی آن اجرا کنید.

تا قبل از VPS-003/004، نام‌های `hamidian.shop`، `admin.hamidian.shop`،
`api.hamidian.shop` و `media.hamidian.shop` باید فقط برای تنظیمات برنامه در نظر
گرفته شوند؛ برای ترافیک عمومی به DNS، Nginx و TLS نیاز دارند. هنگام تکمیل
VPS-003، درخواست‌های `/media` دامنهٔ رسانه نیز به API متصل خواهند شد.

در این VPS با دیسک ۵۰ گیگابایتی، پس از هر build حجم imageها و cache را پایش
کنید. بدون اندازه‌گیری و بدون بررسی volumeها، دستور پاک‌سازی سراسری Docker
اجرا نکنید. برای شروع فروش واقعی همچنان SMS واقعی، یک درگاه آزمایش‌شده،
بکاپ/restore (VPS-007) و مراحل امنیتی باقی می‌مانند.
