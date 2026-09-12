# VPS-006 — رسانهٔ دائمی روی دیسک خود VPS

مسیر رسانهٔ قابل‌نوشتن API: `/var/lib/hamidian-silver/media` روی **همان VPS**.
این مسیر خارج از checkout، release directory، image و volume دیتابیس قرار
می‌گیرد. در `compose.production.yaml` فقط API آن را به همان مسیر داخل کانتینر
bind-mount می‌کند و `create_host_path: false` مانع ساخت بی‌صدای مسیر اشتباه
می‌شود. Storefront/Admin فقط URL عمومی
`https://media.hamidian.shop/media/...` را مصرف می‌کنند؛ مسیر واقعی آپلود
`catalog/YYYY/MM/<uuid>.<extension>` داخل همین دایرکتوری است. فایل هر تصویر
و رکورد مربوط به آن در PostgreSQL **با هم** برای restore لازم‌اند.

این مرحله فایل media را منتقل، حذف، پاک‌سازی یا روی سرور کپی نمی‌کند. اول
وجود دادهٔ قبلی را بررسی کنید؛ اگر رسانهٔ واقعی جای دیگری است، بدون بکاپ و
هماهنگی با دیتابیس عملیات مهاجرت انجام ندهید. از `rsync --delete`، پاک‌سازی
`docker ... prune --volumes` یا حذف release حاوی تنها نسخهٔ رسانه استفاده
نکنید.

## نصب اولیه روی VPS؛ فقط اگر این مسیر هنوز ساخته نشده است

از ریشهٔ پروژه روی VPS، **پیش از اجرای `up api`** مالکیت و مسیر را بخوانید:

```bash
sudo ls -ld /var/lib/hamidian-silver /var/lib/hamidian-silver/media
sudo df -h /var/lib
```

اگر دایرکتوری media از قبل وجود دارد، دستورهای ساخت زیر را **اجرا نکنید**؛
در عوض از همان محتوا و مجوزها گزارش بگیرید و preflight را اجرا کنید. برای
نصب تازه، بعد از اطمینان از اینکه این دو مسیر نه symlink هستند و نه متعلق
به برنامهٔ دیگری، دستورهای زیر را اجرا کنید:

```bash
sudo install -d -o root -g root -m 0755 /var/lib/hamidian-silver
sudo install -d -o 1000 -g 1000 -m 0750 /var/lib/hamidian-silver/media
sudo ./deploy/check-production-media.sh
```

UID/GID `1000:1000` متعلق به کاربر غیر root `node` در image فعلی API است.
اگر image را تغییر دادید، UID/GID را دوباره با image و مجوز میزبان تطبیق
دهید؛ مالکیت کل `/var/lib` یا دایرکتوری‌های موجود را بازگشتی تغییر ندهید.
preflight فقط می‌خواند؛ علاوه بر مالکیت و مسیر canonical، وجود حداقل ۱ GiB
فضای آزاد روی فایل‌سیستم رسانه را می‌سنجد. اگر خطا داد، **API/deploy را ادامه
ندهید**؛ ابتدا علت را مشخص کنید، به‌ویژه اگر media پر/مفقود شده یا مسیر به
release اشاره می‌کند. روی دیسک ۵۰ GB که رسانه و بکاپ هر دو روی همان VPS
می‌مانند، ۱ GiB برای build یا بکاپ کفایت نمی‌کند؛ کنترل فضای لازم واقعی قبل
و بعد از هر deploy و هشدار پرشدن دیسک در VPS-008/009 تکمیل می‌شود. حدود
۵ GB مورد انتظار فعلی برای تصویرها سقف ایمن کل دیسک نیست.

## بررسی bind و وضعیت زنده، بعد از بالا آمدن سرویس‌ها

ابتدا از داخل VPS مطمئن شوید `config --quiet` معتبر است، سپس پس از بالا آمدن
API، container ID را بگیرید و mount را **بدون چاپ env کانتینر** بررسی کنید:

```bash
sudo docker compose --env-file /etc/hamidian-silver/production.env -f compose.production.yaml config --quiet
sudo docker compose --env-file /etc/hamidian-silver/production.env -f compose.production.yaml ps
sudo docker inspect --format '{{range .Mounts}}{{if eq .Destination "/var/lib/hamidian-silver/media"}}{{.Type}} {{.Source}} {{.RW}}{{end}}{{end}}' "$(sudo docker compose --env-file /etc/hamidian-silver/production.env -f compose.production.yaml ps -q api)"
curl -i https://api.hamidian.shop/api/v1/health/ready
sudo df -h /var/lib/hamidian-silver/media
sudo du -sh /var/lib/hamidian-silver/media
```

مقدار `docker inspect` باید `bind /var/lib/hamidian-silver/media true`
باشد. پاسخ ready در production باید علاوه بر `database`، مقدار
`"media":"ok"` داشته باشد. readiness حالا وجود دایرکتوری واقعی، دسترسی
خواندن/نوشتن کاربر API و فضای آزاد کافی برای حداقل دو آپلود ۱۰ MiB را
کنترل می‌کند و در خرابی ۵۰۳ می‌دهد. این بررسی جای آپلود و مشاهدهٔ واقعی
عکس را نمی‌گیرد: در staging یک تصویر آزمایشی را از پنل آپلود کنید، URL
`media.hamidian.shop` و وجود فایل روی میزبان را تأیید کنید و سپس در یک
انتشار کنترل‌شده/راه‌اندازی مجدد، بدون حذف پوشهٔ میزبان، همان URL را دوباره
بررسی کنید. اگر سایت مشتری فعال است، API را فقط برای این آزمایش بی‌مقدمه
restart نکنید.

## قواعد نگهداری و مراحل بعد

- media را داخل `/etc/hamidian-silver` (برای secretها)، release directory
  یا پوشهٔ Docker build کپی نکنید. اشتراک‌گذاری mount فقط برای API است؛
  Nginx درخواست‌های GET/HEAD دامنهٔ media را به API می‌فرستد.
- PostgreSQL فهرست فایل‌ها و اتصال تصویر به محصول/محتوا را نگه می‌دارد.
  در VPS-007 بکاپ منظم **دیتابیس و رسانه با هم**، نگهداری محلی و دانلود
  دستی برای سیستم شخصی به‌همراه تست واقعی restore اضافه می‌شود.
- در VPS-009 مسیر `/var/lib/hamidian-silver/media` در هر بررسی و پاک‌سازی
  قبل/بعد deploy مصون می‌ماند. GitHub Actions فقط push به `main` را پس از
  آماده‌شدن staging و تأیید استقرار production منتشر می‌کند؛ نه release
  پاک‌شده، نه image جدید، نباید مالک دادهٔ media باشد.

منبع: [رفتار و محدودیت‌های bind mount در Docker](https://docs.docker.com/engine/storage/bind-mounts/).
