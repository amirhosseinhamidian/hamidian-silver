# VPS-004 — HTTPS، firewall و محدودکردن دسترسی به دیتابیس

این مرحله برای Ubuntu 24.04 و Nginx روی **خود میزبان**، با پنج نام
`hamidian.shop`، `www.hamidian.shop`، `admin.hamidian.shop`،
`api.hamidian.shop` و `media.hamidian.shop` نوشته شده است. ابتدا گواهی
Let's Encrypt با HTTP-01 گرفته می‌شود؛ **پیش از صدور موفق گواهی، هیچ‌کدام از
برنامه‌ها روی HTTP عمومی منتشر نمی‌شوند**. این فایل‌ها روی VPS چیزی را خودکار
نصب یا فعال نمی‌کنند. مراحل را در نشست SSH تعاملی و با دسترسی کنسول ارائه‌دهنده
در صورت نیاز اجرا کنید؛ هنوز تا VPS-005/010/011 سایت را production-ready
فرض نکنید.

## ۱. بررسی قبل از تغییر firewall و DNS

- رکوردهای A هر پنج نام را به IPv4 سرور وصل کنید؛ اگر رکورد AAAA دارید باید
  IPv6 آن هم واقعاً روی همین سرور پاسخ دهد. رکورد AAAA قدیمی را **پس از بررسی
  مالکیت DNS** اصلاح/حذف کنید؛ Certbot برای هر نام درخواست اعتبارسنجی می‌فرستد.
  اگر CAA محدودکننده دارید، صدور توسط Let's Encrypt را مجاز کنید. پورت ۸۰
  باید از اینترنت، نه فقط از localhost، به همین Nginx برسد.
- پورت واقعی SSH را از تنظیمات میزبان/پنل VPS و نشست فعلی تأیید کنید؛ صرفاً
  به پیش‌فرض ۲۲ تکیه نکنید. firewall پنل ارائه‌دهنده و IPv4/IPv6 را نیز بررسی
  کنید. **پیش از فعال‌سازی UFW، پورت SSH درست را allow کنید و یک نشست SSH
  دوم باز کنید**؛ اگر نشست دوم وصل نمی‌شود، UFW را فعال نکنید.
- از ریشه پروژه روی VPS، Compose باید فقط API/Storefront/Admin را به loopback
  وصل کند. `postgres` و `redis` در `compose.production.yaml` اصلاً `ports`
  ندارند. خروجی این دستورها را بررسی کنید؛ اگر ۵۴۳۲/۶۳۷۹ یا ۳۱۰۰–۳۱۰۲ روی
  `0.0.0.0`/`[::]` دیده می‌شود، ادامه ندهید:

```bash
sudo ss -lntp
sudo docker compose --env-file /etc/hamidian-silver/production.env -f compose.production.yaml ps
docker version --format '{{.Server.Version}}'
sudo ufw status verbose
```

Docker ممکن است firewall ساده UFW را برای پورت‌های منتشرشده دور بزند؛ محافظت
اصلی دیتابیس/Redis این است که **اصلاً پورت میزبان ندارند**. پورت‌های ۳۱۰۰–۳۱۰۲
باید به `127.0.0.1` محدود بمانند. در نسخه‌های Docker Engine پیش از 28، bind
لوپ‌بک ممکن است در همان شبکهٔ لایهٔ ۲ قابل دسترس باشد؛ برای انتشار عمومی، نسخه
Engine و جداسازی شبکه را بررسی کنید و در صورت نیاز ارتقا دهید. PostgreSQL و
Redis را به اینترنت publish نکنید، حتی اگر UFW فعال است.

برای UFW، **`SSH_PORT` زیر را با عددِ تأییدشدهٔ همان سرور جایگزین کنید**؛
فرمان‌ها را عیناً با مقدار نمونه اجرا نکنید:

```bash
sudo ufw allow SSH_PORT/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw status verbose
```

حالا در یک ترمینال دیگر از خارج VPS با SSH وارد شوید و سپس، فقط اگر قوانین
SSH/HTTP/HTTPS و وضعیت IPv6 درست‌اند، `sudo ufw enable` و دوباره
`sudo ufw status verbose` را اجرا کنید. policy فایروال ارائه‌دهنده نیز باید
SSH محدودشده و ۸۰/۴۴۳ را پوشش دهد؛ هیچ قانون باز عمومی برای دیتابیس لازم نیست.
از `ufw reset` یا پاک‌کردن قواعد Docker استفاده نکنید.

## ۲. فعال‌کردن فقط challenge HTTP، بدون انتشار سایت

روی VPS از ریشهٔ checkout، ابتدا فایل‌های فعلی `/etc/nginx/sites-enabled/`
را بررسی کنید. در Ubuntu معمولاً symlink پیش‌فرض `default` پورت ۸۰ را می‌گیرد؛
فقط اگر مطمئن شدید سایت دیگری پشت آن نیست، symlink آن را غیرفعال کنید.
config مرحلهٔ VPS-003 روی `127.0.0.1:8080` می‌تواند در این مرحله فعال بماند.

```bash
sudo ls -l /etc/nginx/sites-enabled/
sudo install -d -m 0755 /var/www/hamidian-silver-acme/.well-known/acme-challenge
sudo install -m 0644 deploy/nginx/hamidian-silver-acme.conf /etc/nginx/sites-available/hamidian-silver-acme.conf
sudo ln -s /etc/nginx/sites-available/hamidian-silver-acme.conf /etc/nginx/sites-enabled/hamidian-silver-acme.conf
sudo nginx -t
sudo systemctl reload nginx
```

اگر symlink از قبل هست، `ln -s` را تکرار نکنید. اگر سایت پیش‌فرض واقعی روی
پورت ۸۰ فعال باشد، `nginx -t` ممکن است به‌علت `default_server` تکراری fail
شود: علت را بررسی کنید و **فقط پس از تأیید اینکه سایت دیگری به آن وابسته
نیست**، `sudo unlink /etc/nginx/sites-enabled/default` را اجرا کنید؛ سپس
`sudo nginx -t && sudo systemctl reload nginx`. در bootstrap، درخواست غیر از
`/.well-known/acme-challenge/` برای دامنه‌های شناخته‌شده ۴۰۴ می‌گیرد.

## ۳. صدور گواهی و انتقال کنترل‌شدهٔ پیکربندی به HTTPS

از package manager Ubuntu Certbot را نصب کنید. `--webroot` خودش فایل challenge
را داخل مسیر بالا می‌نویسد و Nginx را دستکاری نمی‌کند. صدور گواهی به DNS
درست، مسیر HTTP عمومی و پذیرش شرایط سرویس بستگی دارد:

```bash
sudo apt update
sudo apt install certbot
sudo certbot certonly --webroot -w /var/www/hamidian-silver-acme --cert-name hamidian.shop -d hamidian.shop -d www.hamidian.shop -d admin.hamidian.shop -d api.hamidian.shop -d media.hamidian.shop
sudo certbot certificates
```

اگر صدور ناموفق بود **config TLS را نصب نکنید**. پس از موفقیت، وجود
`/etc/letsencrypt/live/hamidian.shop/fullchain.pem` و `privkey.pem` را چک
کنید؛ کلید خصوصی یا متن آن را در Git، خروجی قابل اشتراک یا نسخهٔ بکاپِ عمومی
قرار ندهید. پیش از سوییچ، مطمئن شوید snippet مرحلهٔ VPS-003 در مسیر
`/etc/nginx/snippets/hamidian-silver-proxy.conf` نصب است. از فایل نصب‌شدهٔ
فعلی Nginx نسخهٔ rollback در همان پوشهٔ میزبان بگیرید:

```bash
sudo cp -a /etc/nginx/sites-available/hamidian-silver.conf /etc/nginx/sites-available/hamidian-silver.vps003.conf
sudo install -m 0644 deploy/nginx/hamidian-silver-tls-snippet.conf /etc/nginx/snippets/hamidian-silver-tls.conf
sudo install -m 0644 deploy/nginx/hamidian-silver-tls.conf /etc/nginx/sites-available/hamidian-silver.conf
sudo unlink /etc/nginx/sites-enabled/hamidian-silver-acme.conf
sudo nginx -t
sudo systemctl reload nginx
```

`unlink` را فقط بعد از مشاهدهٔ symlink دقیق همان سایت اجرا کنید؛ فایل source
در `sites-available` محفوظ است. اگر `nginx -t` ناموفق شد، **reload نکنید**؛
config قبلی را با
`sudo install -m 0644 /etc/nginx/sites-available/hamidian-silver.vps003.conf /etc/nginx/sites-available/hamidian-silver.conf`
برگردانید، symlink ACME را دوباره بسازید، و بعد از `sudo nginx -t` موفق reload
کنید. Nginx پیش از reload موفق با config قبلی کار می‌کند. config نهایی
challenge را روی HTTP نگه می‌دارد و بقیه درخواست‌ها را با ۳۰۸ به HTTPS
می‌برد؛ www روی HTTPS به دامنهٔ اصلی منتقل می‌شود. HSTS فعلاً فقط ۳۰۰ ثانیه
است و `includeSubDomains`/`preload` ندارد.

## ۴. تمدید گواهی و آزمون بیرونی

اسکریپت deploy hook فقط **بعد از تمدید موفق**، ابتدا syntax را می‌سنجد و
سپس Nginx را reload می‌کند. `certbot renew` را در crontab جداگانه هم تنظیم
نکنید؛ timer نصب‌شده توسط بستهٔ Ubuntu را بررسی کنید:

```bash
sudo install -d -m 0755 /etc/letsencrypt/renewal-hooks/deploy
sudo install -m 0755 deploy/nginx/reload-after-renewal.sh /etc/letsencrypt/renewal-hooks/deploy/hamidian-silver-nginx
systemctl list-timers --all certbot.timer
sudo certbot renew --dry-run --run-deploy-hooks
```

در dry-run، deploy hook ممکن است reload کند ولی **گواهی آزمایشی را جایگزین
گواهی واقعی نمی‌کند**. با شبکه‌ای خارج از VPS نیز HTTP→HTTPS، اعتبار گواهی
هر پنج نام، بسته‌بودن ۵۴۳۲/۶۳۷۹/۳۱۰۰–۳۱۰۲، و عدم دسترسی به `/docs` روی
API را چک کنید. چند نمونه پس از آماده‌شدن سرویس‌ها:

```bash
curl -I http://hamidian.shop/
curl -I https://www.hamidian.shop/
curl -i https://hamidian.shop/api/health
curl -i https://admin.hamidian.shop/api/health
curl -i https://api.hamidian.shop/api/v1/health/ready
curl -i https://api.hamidian.shop/docs
curl -i -X POST https://media.hamidian.shop/media/example.webp
```

در حالت سالم به ترتیب redirect به HTTPS، redirect به دامنهٔ اصلی، پاسخ
health مناسب، ۴۰۴ روی docs و ۴۰۳ روی POST رسانه انتظار می‌رود. اگر سرویس‌های
Docker هنوز بالا نیامده‌اند، پاسخ ۵۰۲ در health به‌معنای صدور ناموفق گواهی
نیست؛ سلامت سرویس را پس از VPS-005/010 جداگانه بررسی کنید. برای HTTP-01
پورت ۸۰ را پس از دریافت گواهی نبندید. مرحلهٔ GitHub Actions، deploy از `main`
و پاک‌سازی امن دیسک مطابق قرارداد VPS-003 برای VPS-009 باقی می‌ماند.
