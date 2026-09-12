# VPS-007 — بکاپ روزانه و بازیابی آزمایشی روی همان VPS

این مرحله از **PostgreSQL و فایل‌های media با هم** یک مجموعهٔ مستقل در
`/var/backups/hamidian-silver/backup-YYYYMMDDTHHMMSSZ` می‌سازد. `db.dump`
آرشیو custom-format PostgreSQL، `media.tar.gz` رسانه، `sizes` اندازهٔ پیش از
فشرده‌سازی و `SHA256SUMS` بررسی تمامیت است. مجموعه تنها پس از restore کامل
دیتابیس در کانتینر موقتِ بدون شبکه و استخراج رسانه در دایرکتوری جداگانه، همراه
با وجود همهٔ فایل‌های ارجاع‌شدهٔ فعال در دیتابیس، `.complete` می‌گیرد. این
آزمون **هر روز** همراه با بکاپ اجرا می‌شود؛ خود دیتابیس و media اصلی در آزمون
تغییر نمی‌کنند. فقط دو مجموعهٔ **تأییدشدهٔ اخیر** نگهداری می‌شود؛ بکاپ ناموفق
هیچ بکاپ سالمی را حذف نمی‌کند. اجرا در کمبود فضا متوقف می‌شود، نه اینکه media،
volume، image یا بکاپ سالم به‌صورت سراسری پاک شود.

> بکاپ روی همان VPS در خرابی کامل دیسک/سرور از بین می‌رود؛ دانلود دوره‌ای به
> مک الزامی است. این طرح جایگزین بکاپ مستقل خارج از VPS یا بازیابی نقطه‌به‌نقطه
> (PITR) نیست. `production.env` و رمزها در بکاپ نیستند؛ نسخهٔ امن و جداگانهٔ
> secrets را نیز مطابق VPS-005 **خارج از Git** نگه دارید.

## نصب روی VPS؛ قبل از فعال‌کردن timer

این فرمان‌ها را **روی Ubuntu VPS** از ریشهٔ checkout معتبر اجرا کنید؛ لازم نیست
روی Mac اجرا شوند. ابتدا موجودبودن مسیرها و ظرفیت را بدون تغییر بررسی کنید:

```bash
pwd -P
sudo ls -ld /var/backups/hamidian-silver /opt/hamidian-silver/current /var/lib/hamidian-silver/media
sudo df -h /var/lib/hamidian-silver/media
```

اگر مسیر backup از قبل دارای اطلاعات است، آن را با دستورهای بعدی تغییر مالکیت
یا جایگزین نکنید؛ ابتدا وضعیت و مجوزها را بررسی کنید. در نصب تازه، گروه فقط
برای **خواندن و دانلود بکاپ‌های حاوی اطلاعات سفارش** است. نام حساب SSH خود را
به‌جای `YOUR_SSH_USER` بگذارید؛ فقط فرد مورد اعتماد را عضو کنید:

```bash
sudo groupadd --system hamidian-backup
sudo install -d -o root -g hamidian-backup -m 0750 /var/backups/hamidian-silver
sudo usermod -aG hamidian-backup YOUR_SSH_USER
sudo install -d -o root -g root -m 0755 /usr/local/libexec/hamidian-silver
sudo install -o root -g root -m 0755 deploy/backup-production.sh deploy/restore-test.sh deploy/check-production-media.sh /usr/local/libexec/hamidian-silver/
sudo install -o root -g root -m 0644 deploy/systemd/hamidian-silver-backup.service deploy/systemd/hamidian-silver-backup.timer /etc/systemd/system/
```

مسیر ثابت `/opt/hamidian-silver/current` باید به **checkout واقعی همین release**
که `compose.production.yaml` دارد اشاره کند. اگر هنوز این مسیر وجود ندارد،
از ریشهٔ checkout روی VPS و پس از بررسی خروجی `pwd -P`:

```bash
sudo install -d -o root -g root -m 0755 /opt/hamidian-silver
sudo ln -s "$(pwd -P)" /opt/hamidian-silver/current
readlink -f /opt/hamidian-silver/current
```

اگر `current` از قبل وجود دارد، `ln` را اجرا نکنید؛ مقصدش را بخوانید و در
انتشار بعدی (VPS-009) symlink را فقط پس از آماده‌شدن release جدید به‌صورت
کنترل‌شده جابه‌جا کنید. فایل‌های این checkout و مسیر نصب‌شدهٔ اسکریپت‌ها باید
معتبر باشند؛ مالکیت یا محتوای اسکریپت‌های اجراشونده با root را به حساب
دانلودکنندهٔ بکاپ نسپارید. مسیر env خصوصی طبق VPS-005 همان
`/etc/hamidian-silver/production.env` است.

**اول اجرای دستی و آزمون واقعی**؛ ممکن است چند دقیقه طول بکشد و در زمان
کم‌ترافیک، بدون تغییر فعالِ عکس‌ها، انجام شود. برای دانلود دور اول بهتر است
timer هنوز روشن نباشد. خروجی نباید حاوی رمز یا اطلاعات مشتری باشد:

```bash
sudo /usr/local/libexec/hamidian-silver/backup-production.sh /opt/hamidian-silver/current
sudo ls -la /var/backups/hamidian-silver
```

وقتی پیام `Isolated restore passed` و `Verified backup:` و فایل `.complete`
را دیدید، تایمر روزانه (حدود ۰۳:۲۰ به‌علاوهٔ تأخیر تصادفی تا ۱۵ دقیقه) را
فعال کنید. اگر PostgreSQL آماده نباشد، اجرا fail می‌شود؛ بعد از رفع مشکل
یک اجرای دستی و مشاهدهٔ خروجی لازم است:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now hamidian-silver-backup.timer
systemctl list-timers hamidian-silver-backup.timer
sudo systemctl start hamidian-silver-backup.service
systemctl show hamidian-silver-backup.service -p Result -p ExecMainStatus
sudo journalctl -u hamidian-silver-backup.service -n 60 --no-pager
```

اجرای `systemctl start` نمونهٔ **نوبت بعدی** است و بعد از اجرای دستی یک بکاپ
دوم و restore دوباره می‌سازد؛ اگر فضا کم است، آن را به نوبت بعدی timer موکول
کنید. روی VPS با ۵۰ GB، قبل از نصب و بعد از هر اجرا `df -h` و `du -sh
/var/backups/hamidian-silver` را بررسی کنید؛ دیسک imageهای Docker و build
را نیز نگه می‌دارد. در VPS-008 هشدار کمبود دیسک و شکست job اضافه می‌شود.

## تست مجدد یک بکاپ قدیمی بدون لمس production

پس از انتخاب نام **واقعی و موجود** از خروجی `sudo ls`:

```bash
sudo /usr/local/libexec/hamidian-silver/restore-test.sh /var/backups/hamidian-silver/backup-YYYYMMDDTHHMMSSZ
```

این دستور فقط در کانتینر Postgres با `--network none` و بدون پورت میزبان
restore می‌کند؛ بعد کانتینر و مسیر استخراج موقت خودش پاک می‌شوند. اجرای
restore روی volume تولید، کپی‌کردن archive روی media زنده یا `prisma migrate
dev` بخشی از این تست نیست. تمامیت آرشیو و وجود mediaهای فعال کنترل می‌شود؛
برای آزمون کامل disaster recovery هنوز باید در staging مجزا، با secrets
مجزای آن محیط، گردش ثبت سفارش/آپلود و سرویس‌ها را نیز بررسی کرد.

`pg_dump` یک نمای سازگار **از دیتابیس** می‌گیرد اما فایل‌سیستم media را
اتمیک با دیتابیس snapshot نمی‌کند. در زمان backup از حذف/تغییر فایل توسط پنل
پرهیز کنید؛ اگر بعد از dump فایلی حذف شود، آزمون restore بکاپ را رد می‌کند.
فایل‌های جدیدی که بعد از dump اضافه می‌شوند ممکن است در archive باشند ولی در
DB همان نوبت ارجاع نداشته باشند. این محدودیت را برای بازیابی عملیاتی در نظر
بگیرید و هنگام انتشار تغییرات حساس، backup موفق تازه بگیرید.

## دانلود دستی روی Mac

بعد از عضویت در گروه، از SSH خارج و **دوباره وارد** شوید. ابتدا روی VPS
`id YOUR_SSH_USER` را بررسی کنید و نام مجموعهٔ تکمیل‌شده را بردارید. سپس روی
**Mac** (نه VPS)، با حساب SSH و نام بکاپ واقعی و آدرس IP یا دامنهٔ SSH سرور:

```bash
scp -r YOUR_SSH_USER@YOUR_VPS_HOST:/var/backups/hamidian-silver/backup-YYYYMMDDTHHMMSSZ "$HOME/Downloads/"
cd "$HOME/Downloads/backup-YYYYMMDDTHHMMSSZ"
shasum -a 256 -c SHA256SUMS
```

اگر هر سه فایل تأیید نشدند، آن نسخه را بکاپ سالم ندانید. فایل‌ها شامل دادهٔ
شخصی مشتری هستند: با آن‌ها مثل رمز برخورد کنید؛ روی مک فقط در فضای رمزنگاری‌شده
نگه دارید و در Git، ایمیل یا پوشهٔ عمومی قرار ندهید. حذف دستی بکاپ از VPS
قبل از تأیید دانلود و checksum توصیه نمی‌شود. `scp` فقط می‌خواند، روی VPS
کپی اضافه نمی‌سازد؛ عضو گروه backup به Docker یا env خصوصی دسترسی نمی‌گیرد.

## آیندهٔ deploy خودکار

اسکریپت و تایمر root-owned خارج از release، داده‌ها در
`/var/backups/hamidian-silver` و `/var/lib/hamidian-silver/media` می‌مانند.
GitHub Actions و پاک‌سازی امن قبل/بعد deploy در VPS-009 انجام می‌شوند؛ هیچ
`docker system prune --volumes`، پاک‌کردن همین بکاپ‌ها/رسانه، یا توقف بکاپ
به عنوان پاک‌سازی مجاز نیست. اگر restore یا بکاپ خطا داد، پیش از deploy
بعدی علت و فضای خالی را بررسی کنید؛ image قدیمیِ لازم برای rollback را
کورکورانه حذف نکنید.

منابع: [PostgreSQL pg_dump](https://www.postgresql.org/docs/current/app-pgdump.html)،
[PostgreSQL pg_restore](https://www.postgresql.org/docs/current/app-pgrestore.html).
