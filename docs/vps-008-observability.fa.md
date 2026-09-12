# VPS-008 — لاگ، پایش سلامت و هشدار کمبود فضا

این مرحله روی Ubuntu VPS متعلق به `hamidian.shop` اجرا می‌شود و **خودش هیچ
داده‌ای پاک نمی‌کند**. Docker Compose از VPS-002 برای هر کانتینر از driver
`local` با سقف `10m × 3` استفاده می‌کند؛ تنظیمات جدید journal میزبان را به
۲۵۰ MB و حداکثر ۱۴ روز محدود می‌کند. لاگ دسترسی Nginx از قبل query string
را حذف می‌کرد؛ حالا timestamp عددی هم دارد تا مانیتور فقط **تعداد** HTTP 5xx
در پنج دقیقهٔ گذشته را بشمارد. مسیر درخواست، IP، بدنه و stack trace وارد
هشدار بیرونی نمی‌شوند. لاگ خطای Nginx جدا از access log در
`/var/log/nginx/hamidian-silver-error.log` است و با logrotate فعلی nginx باید
چرخانده شود؛ قبل از نصب، وجود rule مربوط به `/var/log/nginx/*.log` را بررسی
کنید. این logها ممکن است دادهٔ حساس عملیاتی داشته باشند: دسترسی‌شان را محدود
نگه دارید و خامِ آن‌ها را به سرویس اعلان ارسال نکنید.

مانیتور هر حدود دو دقیقه این موارد را بدون دستکاری production می‌سنجد:

| کنترل | آستانه / رفتار |
| --- | --- |
| Nginx و TLS داخلی | endpointهای `/api/v1/health/ready` روی API و `/api/health` روی فروشگاه و پنل، با نام دامنهٔ اصلی و اتصال loopback (بدون عبور از proxy محیط) |
| Docker | health status کانتینرهای PostgreSQL، Redis، API، Storefront و Admin |
| API errors | حداقل ۳ پاسخ HTTP 5xx در پنجرهٔ پنج‌دقیقه‌ایِ log فعلی و چرخش اخیر؛ فقط شمارش، نه دادهٔ درخواست |
| بکاپ | آخرین بکاپ `.complete`/`verified-at-utc` کمتر از ۳۰ ساعت عمر داشته باشد و service بکاپ fail نشده باشد |
| فضای دیسک | برای filesystem ریشه، media، backup و Docker: کمتر از ۱۲ GiB فضای آزاد **یا** کمتر از ۲۰٪، و کمتر از ۵٪ inode |

اخطار در journal ثبت می‌شود، از صدور تکراری یک وضعیت تا ۳۰ دقیقه جلوگیری
می‌شود و پس از بهبودی پیام recovery فرستاده می‌شود. webhook اختیاریِ
`{"text":"..."}` برای گیرندهٔ HTTPS سازگار با Slack/Mattermost است؛ نشانی
خصوصی آن فقط روی VPS در `/etc/hamidian-silver/monitor.env` با مالک root و
مجوز 0600 نگهداری می‌شود. بدون آن **هشدار بیرونی ندارید** و باید journal را
دستی ببینید؛ تا قبل از راه‌اندازی و آزمون یک مقصد واقعی، ادعای پایش خودکار
قابل‌اطمینان برای فروش واقعی نکنید. داده و لاگ همچنان روی دیسک VPS است و
تنها پیام مختصر خطا برای گیرنده ارسال می‌شود.
این شمارندهٔ HTTP جایگزین سامانهٔ ردیابی کامل exception یا عملکرد تک‌تک
تراکنش‌های پرداخت نیست؛ خطاهای مدیریت‌شده‌ای که پاسخ ۲xx می‌دهند در آن دیده
نمی‌شوند و باید در لاگ عملیاتی/تست‌های خرید نیز بررسی شوند.

## نصب ایمن، فقط روی VPS

ابتدا VPS-007 و Nginx/TLS production را طبق راهنما نصب کرده و یک بکاپ
تأییدشده داشته باشید. از ریشهٔ checkout معتبر، **قبل از جایگزینی فایل Nginx**
مطمئن شوید این سایت TLS هنوز همان فایل مرحلهٔ VPS-004 است؛ اگر config سفارشی
شده، تفاوت‌ها را دستی ادغام کنید و فایل فعلی را حفظ کنید:

```bash
sudo ls -l /etc/nginx/sites-available/hamidian-silver.conf
sudo ls -l /etc/nginx/sites-available/hamidian-silver.pre-vps008
sudo sed -n '1,120p' /etc/logrotate.d/nginx
sudo cp -an /etc/nginx/sites-available/hamidian-silver.conf /etc/nginx/sites-available/hamidian-silver.pre-vps008
sudo install -o root -g root -m 0644 deploy/nginx/hamidian-silver-tls.conf /etc/nginx/sites-available/hamidian-silver.conf
sudo nginx -t && sudo systemctl reload nginx
```

گزینهٔ `-n` از بازنویسی نسخهٔ `pre-vps008` جلوگیری می‌کند؛ اگر این نسخه
از قبل وجود دارد، پیش از نصب علت را بررسی کنید. اگر `nginx -t` خطا داد
**reload نکنید**، فایل پیشین را
از نسخهٔ حفظ‌شده بازگردانید و علت را بررسی کنید. فایل
`deploy/nginx/hamidian-silver.conf` برای محیط loopback قبل از TLS نیز
همگام شده اما در VPS دارای TLS نباید جای فایل TLS نصب شود. اگر rule nginx
برای logrotate وجود ندارد یا wildcard آن فایل جدید `*-error.log` را شامل
نمی‌شود، timer را فعال نکنید تا محدودسازی چرخش logها مشخص شود.

پس از بررسی فایل خصوصی VPS-005 و مسیر root-owned اسکریپت‌های VPS-007:

```bash
sudo install -o root -g root -m 0755 deploy/monitor-production.py /usr/local/libexec/hamidian-silver/monitor-production.py
sudo install -o root -g root -m 0644 deploy/systemd/hamidian-silver-monitor.service deploy/systemd/hamidian-silver-monitor.timer /etc/systemd/system/
sudo install -d -o root -g root -m 0755 /etc/systemd/journald.conf.d
sudo install -o root -g root -m 0644 deploy/journald/50-hamidian-silver.conf /etc/systemd/journald.conf.d/50-hamidian-silver.conf
sudo systemctl restart systemd-journald
sudo systemctl daemon-reload
sudo systemctl start hamidian-silver-monitor.service
systemctl show hamidian-silver-monitor.service -p Result -p ExecMainStatus
sudo journalctl -u hamidian-silver-monitor.service -n 40 --no-pager
```

اجرای دستی **تا پیش از سلامت تمام سرویس‌ها یا وجود بکاپ** می‌تواند با کد ۱
خارج شود؛ این هشدار واقعی است، نه مجوز برای خاموش‌کردن کنترل. سقف journal
روی کل میزبان اثر دارد؛ پیش از restart، پیکربندی دیگر drop-inهای موجود را
بررسی کنید، سپس `journalctl --disk-usage` و فضای دیسک را مشاهده کنید.
لاگ‌های Docker با `sudo docker compose --env-file
/etc/hamidian-silver/production.env -f compose.production.yaml logs --tail 80 api`
قابل بررسی‌اند؛ خروجی خام ممکن است PII یا secrets داشته باشد و نباید در
گفت‌وگو یا issue عمومی منتشر شود.

تست واحد مانیتور (روی Mac، بدون تماس با Docker یا سرور) را می‌توانید با
`python3 -m unittest discover -s deploy -p 'test_monitor_production.py'`
اجرا کنید؛ آزمون عملی نصب و هشدار بیرونی صرفاً روی VPS و گیرندهٔ واقعی است.

## راه‌اندازی هشدار بیرونی و آزمون واقعی

اگر سرویس اعلان سازگار با JSON `text` دارید، webhook آن را در VPS و **خارج
از Git** تعریف کنید. فقط اگر فایل جدید است آن را بسازید؛ فایل موجود را
بازنویسی نکنید. از `sudoedit` استفاده کنید تا URL در تاریخچهٔ shell،
`systemctl show` یا خروجی Compose قرار نگیرد:

```bash
sudo ls -l /etc/hamidian-silver/monitor.env
sudo test -e /etc/hamidian-silver/monitor.env || sudo install -o root -g root -m 0600 /dev/null /etc/hamidian-silver/monitor.env
sudoedit /etc/hamidian-silver/monitor.env
```

محتوا **تنها یک خط** است: `MONITOR_WEBHOOK_URL=https://...`. اگر فایل از
قبل موجود است فقط آن را بررسی/ویرایش کنید؛ در بازبینی خروجی
نشانی واقعی یا token را اینجا نفرستید. برای آزمون اعلان بدون قطع سرویس یا
پرکردن دیسک، موقتاً مانیتور را **پیش از پیکربندی webhook** روی سرور سالم
اجرا کنید تا اگر هنوز بکاپ آماده نیست هشدار محلی را ببینید؛ پس از
پیکربندی، ارسال آزمایشیِ امن از دستور زیر فقط یک پیام `test` ثابت می‌فرستد
و URL را چاپ نمی‌کند:

```bash
sudo python3 /usr/local/libexec/hamidian-silver/monitor-production.py --self-test-alert
```

پس از دریافت پیام تست توسط خودتان، یک اجرای واقعی انجام دهید؛ اگر وضعیت
سالم است خروجی می‌تواند خالی باشد. سپس timer را فعال کنید:

```bash
sudo systemctl start hamidian-silver-monitor.service
sudo systemctl enable --now hamidian-silver-monitor.timer
systemctl list-timers hamidian-silver-monitor.timer
sudo journalctl -u hamidian-silver-monitor.service -n 60 --no-pager
```

اگر webhook جواب ندهد، job با کد ۱ fail می‌شود و journal فقط عبارت کلی
`delivery failed` نشان می‌دهد؛ URL/token وارد log نمی‌شود. مطمئن شوید
دسترسی خروجی HTTPS VPS به گیرنده در شرایط واقعی برقرار است. اگر گیرنده
فقط قالب دیگری مثل `content` می‌پذیرد، آن را با قالب `text` اشتباه نگیرید:
قبل از روشن‌کردن تایمر یک adapter معتبر تنظیم کنید، نه ارسال دادهٔ حساس
با فرمان curl دست‌نویس.

## محدودیت و حادثه

این پایش **از داخل همان VPS** انجام می‌شود و قطع کامل برق/شبکهٔ VPS را
نمی‌تواند به شما خبر بدهد؛ برای production یک check مستقل **بیرون از VPS**
روی `https://api.hamidian.shop/api/v1/health/ready` و در صورت امکان
دامنه‌های فروشگاه و ادمین تنظیم کنید. هدف این است که خرابی کامل سرور نیز
به همان گیرندهٔ اعلان برسد. نه checksum تصویرها و نه بکاپی که فقط روی همین
VPS مانده در قطعی کامل قابل دسترسی نیستند؛ نسخهٔ دانلودشدهٔ مک همچنان لازم
است. در رخداد، ابتدا نتیجهٔ health، journal مانیتور، `journalctl -u
hamidian-silver-backup.service`، فضای root/media/backup و logهای Docker را
بدون افشای secrets ببینید. راهنمای رخدادهای پنل در
`docs/admin-operations-runbook.fa.md` است. هنگام deploy برنامه‌ریزی‌شده
ممکن است هشدار کوتاه ایجاد شود؛ در VPS-009 گردش deploy خودکار، اعتبارسنجی
قبل/بعد، و پاک‌سازی **فقط image و فایل غیرلازم، بدون حذف backup، media یا
volume** اضافه می‌شود.

منابع: [محدودسازی logهای Docker](https://docs.docker.com/engine/logging/drivers/local/)،
[گزینه‌های journal سیستم‌دی](https://www.freedesktop.org/software/systemd/man/latest/journald.conf.html)،
[timer سیستم‌دی](https://www.freedesktop.org/software/systemd/man/latest/systemd.timer.html)،
[لاگ Nginx](https://nginx.org/en/docs/http/ngx_http_log_module.html).
