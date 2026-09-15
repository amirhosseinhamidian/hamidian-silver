# VPS-010 — staging جدا روی همان VPS و آزمون خرید واقعی

این patch **فقط فایل‌های آماده‌سازی** را اضافه می‌کند؛ هیچ تغییر روی VPS،
DNS، GitHub Actions یا production انجام نمی‌دهد. مبنا `frontend-v2` است.
قبل از شروع، موفقیت job `verify` برای آخرین commit در GitHub Actions را
بررسی کنید؛ شکست CI را با اجرای دستی staging دور نزنید.
فعال‌سازی دیپلوی production از `main` همچنان
`PRODUCTION_DEPLOY_ENABLED=false` می‌ماند. `pnpm storefront:test:e2e` و E2E
در CI از API **ساختگی** استفاده می‌کنند؛ جایگزین آزمون واقعی زیر نیستند.

staging یک محیط موقت روی **همان VPS با دیسک ۵۰ GB** است، نه تضمین اینکه
production و staging همیشه هم‌زمان روی ۸ GB RAM/۵۰ GB دیسک جا می‌شوند. اگر
هر preflight فضا یا health fail شد، پیشروی نکنید؛ هیچ backup، media، volume
یا image مربوط به rollback production را حذف نکنید. دادهٔ staging از هیچ
بکاپ production بازیابی نمی‌شود؛ برای سفارش فقط محصول demo، نشانی آزمایشی و
شمارهٔ تلفنی که خودتان مالک آن هستید به کار ببرید.

| بخش                          | production (بدون تغییر)                       | staging                                                                               |
| ---------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------- |
| Compose / PostgreSQL / Redis | `hamidian-silver-production` و volumeهای خودش | `hamidian-silver-staging` و `staging_postgres_data`/`staging_redis_data`              |
| media                        | `/var/lib/hamidian-silver/media`              | `/var/lib/hamidian-silver/staging-media`                                              |
| secrets                      | `/etc/hamidian-silver/production.env`         | `/etc/hamidian-silver/staging.env` و `staging-bootstrap.env`                          |
| پورت‌های میزبان              | loopback 3100–3102                            | فقط loopback 3200–3202؛ DB/Redis بدون port                                            |
| دامنه                        | `hamidian.shop`                               | `staging.hamidian.shop`، `admin.staging.hamidian.shop`، `media.staging.hamidian.shop` |
| پرداخت                       | یک درگاه واقعی پس از VPS-011                  | **فقط زرین‌پال sandbox**، فعال‌سازی در DB staging از Admin                            |
| ارسال / آمار                 | Postex خاموش                                  | ارسال دستی، GA/Search Console خاموش، noindex                                          |

## ۱. پیش‌نیازهای بیرونی؛ قبل از هر درخواست صدور گواهی

سه رکورد A بالا باید به IP **همین VPS** برسند و اگر رکورد AAAA وجود دارد
واقعاً به همان سرور متصل باشد؛ باید صاحب DNS آن را تنظیم/تأیید کند. سرور
Nginx/TLS production مرحلهٔ VPS-004 باید سالم بماند. مسیر گواهی staging
مجزا است؛ گواهی production را بازنویسی نکنید. SSH ورودی، ۸۰/۴۴۳ و فضای
دیسک را مثل VPS-004 بررسی کنید. از ریشهٔ checkout تازه و معتبر روی VPS:

```bash
git rev-parse HEAD
sudo df -h / /var/lib/docker /var/lib/hamidian-silver
sudo docker system df
sudo ss -lntp
sudo ls -ld /etc/hamidian-silver /var/lib/hamidian-silver/media /var/backups/hamidian-silver
sudo ls -l /etc/nginx/sites-enabled/ /etc/nginx/sites-available/hamidian-staging.conf
```

اگر قبلاً فایل/کانتینر/volume staging وجود دارد، هیچ کدام از مراحل «ساخت
اولیه» را کورکورانه تکرار نکنید؛ ابتدا مالکیت و دادهٔ آن را مشخص کنید.
`docker compose config` بدون `--quiet` یا `--environment` ممکن است رمزها را
چاپ کند. هیچ credential، SMS یا رمز را در مکالمه یا Git نفرستید.

## ۲. فایل خصوصی و media مخصوص staging؛ فقط نصب اولیه

`POSTGRES_PASSWORD` و `OTP_PEPPER` باید دو مقدار مستقل، متفاوت با production
باشند؛ هنگام ایجاد روی دستگاه/نشست مطمئن، برای هرکدام جدا `openssl rand -hex
32` اجرا کنید. همان رمز دیتابیس را در `DATABASE_URL` با نام‌های دقیق زیر
قرار دهید؛ کاراکترهای رمز hex نیاز به URL encoding ندارند. هر دو فایل را
فقط با `sudoedit` تکمیل کنید:

```bash
sudo test ! -e /etc/hamidian-silver/staging.env && sudo test ! -L /etc/hamidian-silver/staging.env && sudo install -o root -g root -m 0600 deploy/staging.env.example /etc/hamidian-silver/staging.env
sudo test ! -e /etc/hamidian-silver/staging-bootstrap.env && sudo test ! -L /etc/hamidian-silver/staging-bootstrap.env && sudo install -o root -g root -m 0600 deploy/staging-bootstrap.env.example /etc/hamidian-silver/staging-bootstrap.env
sudoedit /etc/hamidian-silver/staging.env
sudoedit /etc/hamidian-silver/staging-bootstrap.env
sudo test ! -e /var/lib/hamidian-silver/staging-media && sudo test ! -L /var/lib/hamidian-silver/staging-media && sudo install -d -o 1000 -g 1000 -m 0750 /var/lib/hamidian-silver/staging-media
```

در `staging.env` مقدار `DATABASE_URL` این قالب را دارد، بدون قرار دادن رمز
در تاریخچهٔ shell:

```text
postgresql://hamidian_staging:<رمز-مخصوص-staging>@postgres:5432/hamidian_staging?schema=public
```

در `staging-bootstrap.env` شماره ادمین را به **شمارهٔ خودتان** و نشانی و
شمارهٔ تماس را به اطلاعات آزمایشی قابل‌شناسایی تغییر دهید. این bootstrap
یک نقش Manager و کالا/موجودی demo فقط در staging می‌سازد. `SMS_PROVIDER`
ابتدا `disabled` است؛ برای ورود OTP و آزمون واقعی، بعد از راه‌اندازی اولیه
مقدار `kavenegar` و کلید و template معتبر را روی **فایل staging** تنظیم و
سرویس API staging را با دستور `up` این مرحله به‌روز کنید. SMS واقعی ممکن
است هزینه داشته باشد؛ فقط به شمارهٔ تحت کنترل شما تست بفرستید. هرگز
`console`، کد OTP ثابتِ E2E محلی یا شمارهٔ کاربر واقعی را وارد staging نکنید.

برای پرداخت، فقط در صورت وجود شناسهٔ معتبر sandbox زرین‌پال، آن را در فایل
staging وارد کنید و پس از seed از پنل **staging** فقط همان gateway را فعال
کنید. وجود credential به‌تنهایی gateway را فعال نمی‌کند. Compose هم
`ZARINPAL_SANDBOX=true` را ثابت می‌کند و validator مقدار فایل را کنترل
می‌کند؛ زیبال/ملت/اعتبارنامهٔ واقعی در staging مجاز نیستند. اگر sandbox یا
Kavenegar در دسترس نیست، مرحلهٔ E2E خرید **ناتمام** می‌ماند؛ نه اینکه
نتیجهٔ mock را پرداخت واقعی فرض کنیم.

## ۳. نصب root-owned و ساخت دیتابیس staging

از ریشهٔ checkout مورد اعتماد؛ اگر فایل‌های نصب‌شده قبلاً وجود دارند، ابتدا
diff و مالکیت‌شان را بررسی کنید، سپس نسخهٔ جدید را آگاهانه نصب کنید:

```bash
sudo install -o root -g root -m 0755 deploy/staging.sh deploy/check-staging-env.py deploy/validate-production-env.py /usr/local/libexec/hamidian-silver/
sudo /usr/local/libexec/hamidian-silver/check-staging-env.py
sudo /usr/local/libexec/hamidian-silver/check-staging-env.py --bootstrap
sudo /usr/local/libexec/hamidian-silver/staging.sh up "$(pwd -P)"
sudo /usr/local/libexec/hamidian-silver/staging.sh seed "$(pwd -P)"
sudo /usr/local/libexec/hamidian-silver/staging.sh status "$(pwd -P)"
```

`up` فقط staging را build و اجرا می‌کند، بعد از بررسی **حداقل ۱۴ GiB قبل و
۱۰ GiB بعد از build**، migrationها را فقط با `prisma migrate deploy` روی
volume staging اعمال و health API/Storefront/Admin را روی loopback بررسی
می‌کند. پیش/پس از build، فقط cache قدیمی و dangling image بدون استفاده
prune می‌شوند. `seed` یک‌بار نقش‌ها، ادمین staging و catalog demo را در
DB staging می‌سازد؛ قبل از فعال‌سازی sandbox آن را اجرا کنید. **بعد از
فعال‌سازی درگاه، seed را تکرار نکنید**: bootstrap ممکن است تنظیم gateway
را دوباره به `disabled` برگرداند. سفارش/موجودی آزمایشی را دستی بررسی کنید.
اگر شروع/seed fail شد،
پایگاه production را «برای راحتی» وصل نکنید؛ logهای staging را با حفظ
محرمانگی از `docker compose` بگیرید، منشأ خطا را پیدا کنید و بعد ادامه دهید.

## ۴. HTTPS با محدودکردن دسترسی

Nginx staging در فایل مستقلی نصب می‌شود. **اول** پیکربندی HTTP-only برای
ACME؛ هیچ اپی به‌صورت HTTP عمومی نمایش داده نمی‌شود. اگر نام
`hamidian-staging.conf` موجود است، قبل از تغییر بررسی و نسخهٔ پشتیبان
بگیرید؛ این فرمان‌های نصب اولیه نباید آن را بازنویسی کنند:

```bash
sudo test ! -e /etc/nginx/sites-available/hamidian-staging.conf && sudo install -o root -g root -m 0644 deploy/nginx/hamidian-staging-acme.conf /etc/nginx/sites-available/hamidian-staging.conf
sudo test ! -e /etc/nginx/sites-enabled/hamidian-staging.conf && sudo ln -s /etc/nginx/sites-available/hamidian-staging.conf /etc/nginx/sites-enabled/hamidian-staging.conf
sudo nginx -t && sudo systemctl reload nginx
sudo certbot certonly --webroot -w /var/www/hamidian-silver-acme --cert-name staging.hamidian.shop -d staging.hamidian.shop -d admin.staging.hamidian.shop -d media.staging.hamidian.shop
sudo certbot certificates
```

اگر Certbot شکست خورد، **TLS config را نصب نکنید**؛ DNS/CAA/IPv6 و مسیریابی
challenge را بدون دست‌زدن به سایت production بررسی کنید. بعد از صدور موفق
گواهی، فایل Basic Auth مخصوص staging را با ابزار `htpasswd` تعاملی بسازید.
برای `htpasswd` در صورت نبودن، بستهٔ `apache2-utils` را نصب کنید. `-c`
فقط برای **فایل تازه** است؛ اگر فایل موجود است، آن را بررسی کنید و `-c`
نزنید. username جدید را به جای `stagingtester` وارد کنید:

```bash
sudo test ! -e /etc/nginx/hamidian-staging.htpasswd && sudo htpasswd -c -B /etc/nginx/hamidian-staging.htpasswd stagingtester
sudo chown root:www-data /etc/nginx/hamidian-staging.htpasswd
sudo chmod 0640 /etc/nginx/hamidian-staging.htpasswd
sudo cp -an /etc/nginx/sites-available/hamidian-staging.conf /etc/nginx/sites-available/hamidian-staging.pre-tls.conf
sudo install -o root -g root -m 0644 deploy/nginx/hamidian-staging-tls-snippet.conf /etc/nginx/snippets/hamidian-staging-tls.conf
sudo install -o root -g root -m 0644 deploy/nginx/hamidian-staging-tls.conf /etc/nginx/sites-available/hamidian-staging.conf
sudo nginx -t && sudo systemctl reload nginx
```

اگر `nginx -t` fail شد، reload نکنید؛ علت را بررسی و فایل staging قبلی را
از `hamidian-staging.pre-tls.conf` برگردانید. production Nginx و گواهی آن
نباید دست بخورند. storefront و Admin نیاز به Basic Auth دارند؛ callback
باریکِ `/api/payment/callback/<UUID>` از auth مستثناست تا درگاه بتواند
برگردد. media فقط `GET/HEAD` عمومی است تا `next/image` بتواند آن را
بخواند؛ فقط تصویر demo و غیرحساس آپلود کنید. Nginx هدر `noindex` و
`no-store` می‌فرستد، اما **noindex مرز امنیتی نیست**. API عمومی staging
اصلاً تعریف نشده است. در مرورگر وضعیت Basic Auth و لاگین را بررسی کنید؛
`curl -I https://staging.hamidian.shop/` بدون اعتبارنامه باید 401 باشد و
`curl -I https://admin.staging.hamidian.shop/` نیز 401.

## ۵. آزمون نهایی و ثبت نتیجه

قبل از خرید، `sudo /usr/local/libexec/hamidian-silver/staging.sh smoke
"$(pwd -P)"` و `sudo df -h / /var/lib/docker` را بررسی کنید. با مرورگر
واقعی و دادهٔ خودتان، نتیجهٔ هر مورد را با زمان و سفارش test ثبت کنید:

1. Basic Auth staging و OTP **واقعی** از Kavenegar به شمارهٔ مالک تست؛
   نقش Manager در `admin.staging.hamidian.shop` و دسترسی User به فروشگاه.
2. عکس demo، فهرست محصول، جستجو و جزئیات؛ محصول demo موجود به سبد افزوده
   شود؛ نشانی **آزمایشی** ساخته شود، ارسال دستی رایگان/ثابت بررسی شود.
3. تنها gateway sandbox در پنل staging فعال شود؛ checkout و هدایت به
   sandbox، بازگشت از callback HTTPS **staging**، صفحهٔ نتیجه و وضعیت سفارش
   و payment attempt در API/پنل با هم سازگار باشند. در مرحلهٔ pending/unknown
   موفقیت را جعل نکنید؛ مسیر reconciliation را هم بررسی کنید.
4. refresh نتیجه خرید نباید خرید دوم بسازد؛ سفارش موجودی و Audit Log و
   پیام‌های خطای امن بررسی شوند. چند محیط و پروفایل موبایل/دسکتاپ را طبق
   SF-FINAL-03/04 پوشش دهید؛ مقدار رمز/OTP و اطلاعات مشتری را در گزارش
   تست یا Git ننویسید.
5. DB/Redis staging فقط در شبکه Docker و پورت 3200–3202 فقط loopback؛
   API production `/api/v1/health/ready`، حجم media و آخرین بکاپ
   `.complete` production پیش/بعد از staging ثابت و سالم باشند.

تا قبل از تکمیل بند ۳ با پرداخت موفق _sandbox_، این مرحله را «قبول‌شده»
اعلام نکنید. درگاه واقعی و پرداخت کم‌مبلغ واقعی فقط در VPS-011 و پس از
تأیید جداگانهٔ شما انجام می‌شود.

## ۶. بعد از تست؛ جلوگیری از پرشدن دیسک

برای آزادکردن RAM بدون ازبین‌بردن دادهٔ آزمایشی، فقط staging را متوقف کنید:

```bash
sudo /usr/local/libexec/hamidian-silver/staging.sh stop "$(pwd -P)"
sudo docker system df
sudo df -h / /var/lib/docker
```

این فرمان **نه volume staging را حذف می‌کند، نه بکاپ و media را**. اگر بعداً
قصد حذف دائمی دادهٔ آزمایشی دارید، ابتدا نام دقیق volumeهای staging را با
`sudo docker volume ls --filter label=com.docker.compose.project=hamidian-silver-staging`
و حجمشان را بخوانید؛ حذف تنها بعد از تأیید کتبی شما و بررسی اینکه DB/media
staging حاوی دادهٔ موردنیاز نیست انجام شود. این patch هیچ دستور حذف خودکار
volume، media، release، secrets یا گواهی ندارد. هر بکاپ روی همان VPS در
خرابی دیسک از بین می‌رود؛ بکاپ production را مطابق VPS-007 دوره‌ای روی مک
دانلود کنید. **مرحلهٔ بعد VPS-011 است**؛ متغیر deploy خودکار main را تا
پایان go-live خاموش نگه دارید.

منابع: [Docker Compose env-fileهای متعدد](https://docs.docker.com/compose/how-tos/environment-variables/variable-interpolation/)،
[Compose run --rm](https://docs.docker.com/reference/cli/docker/compose/run/)،
[Certbot webroot](https://certbot.eff.org/instructions?ws=nginx&os=snap).
