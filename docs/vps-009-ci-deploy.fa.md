# VPS-009 — CI و دیپلوی کنترل‌شده از main

**این patch دیپلوی production را فعال نمی‌کند.** ابتدا در VPS-010 staging را
راه‌اندازی و E2E/restore را تأیید کنید و در VPS-011 اولین انتشار production و
پرداخت کم‌مبلغ را دستی بررسی کنید؛ **بعد** متغیر GitHub
`PRODUCTION_DEPLOY_ENABLED=true` را تنظیم کنید. تا آن زمان push روی
`frontend-v2` یا `main` فقط CI را اجرا می‌کند. هیچ دستور این راهنما از روی
مک به‌صورت خودکار روی VPS اجرا نمی‌شود.

## CI

`.github/workflows/production.yml` در push به `frontend-v2` و `main` و PR
به main این کنترل‌ها را روی GitHub runner انجام می‌دهد: نصب lockfile،
`pnpm verify` (format، lint، typecheck، تست‌های API/پنل/سایت و build)، تست
ابزارهای میزبان، اعمال migrationها روی PostgreSQL **موقت و جدا از سرور** با
فقط `prisma migrate deploy`، و E2E خرید با API ساختگی Playwright. این تست‌ها
دیتابیس production و secrets آن را لمس نمی‌کنند. برای merge به main، در
Branch protection این workflow را به‌عنوان required check تنظیم کنید؛ قانون
branch protection و مجوز push را صاحب repository باید فعال کند.

workflow تنها در **push موفق به main** و بعد از موفقیت verify، از یک حساب SSH
اختصاصی برای انتقال آرشیو همان git commit به سرور استفاده می‌کند. نه pull
روی production انجام می‌شود و نه production secrets به runner منتقل می‌شوند.
خروجی `docker compose config` فقط با `--quiet` استفاده می‌شود.

## آماده‌سازی حساب مخصوص deploy؛ فقط روی Ubuntu VPS

پیش‌نیاز: مراحل VPS-001 تا VPS-008 کامل، `/opt/hamidian-silver/current` یک
symlink به checkout سالم و **root-owned** با فایل Compose، بکاپ موفق و قابل
restore، Nginx/TLS سه دامنهٔ `hamidian.shop`، `api.hamidian.shop` و
`admin.hamidian.shop` فعال، و secrets روی سرور با mode 0600. سروری که هنوز
bootstrap نشده یا current/بکاپ ندارد توسط اسکریپت **عمداً رد می‌شود**. در
پایان مرحله VPS-010 ابتدا deployment آزمایشی با همین مسیر را در staging مجزا
تست کنید؛ محتویات مسیرهای staging و production را قاطی نکنید.

در checkout مطمئن روی VPS، قبل از نصب فایل‌ها وضعیت قبلی را بخوانید؛ اگر
این نام حساب یا sudoers قبلاً وجود دارد، خروجی را بررسی کنید، به‌هیچ‌وجه
آن را کورکورانه overwrite نکنید:

```bash
sudo id hamidian-deploy
sudo ls -ld /opt/hamidian-silver /opt/hamidian-silver/current /usr/local/libexec/hamidian-silver
sudo ls -l /etc/sudoers.d/hamidian-silver-deploy
sudo df -h / /var/lib/hamidian-silver/media /var/backups/hamidian-silver /var/lib/docker
```

برای نصب اولیه، یک حساب **بدون گروه docker یا گروه hamidian-backup** و با
SSH key اختصاصی GitHub Actions بسازید. public key مربوط به private key
مخصوص این پروژه را فقط برای همین حساب در `authorized_keys` نصب کنید. کلید
خصوصی را در Git/فایل env یا روی سرور ذخیره نکنید. حساب deploy در عمل توانایی
ساخت image از کد main را دارد؛ دسترسی به secrets آن را مثل دسترسی به root
حساس تلقی کنید، branch main را محافظت کنید و اجرای workflow از fork/PR را
با secrets تولیدی انجام ندهید.

```bash
sudo adduser --disabled-password --gecos '' hamidian-deploy
sudo install -d -o root -g root -m 0755 /opt/hamidian-silver/releases
sudo install -o root -g root -m 0755 deploy/receive-production-release.py deploy/deploy-production.sh /usr/local/libexec/hamidian-silver/
sudo visudo -cf deploy/sudoers/hamidian-silver-deploy
sudo install -o root -g root -m 0440 deploy/sudoers/hamidian-silver-deploy /etc/sudoers.d/hamidian-silver-deploy
sudo visudo -cf /etc/sudoers
```

برای نصب SSH public key، `sudo install -d -o hamidian-deploy -g
hamidian-deploy -m 0700 /home/hamidian-deploy/.ssh` و بعد با `sudoedit` فایل
`/home/hamidian-deploy/.ssh/authorized_keys` را بسازید؛ مالکیتش را
`hamidian-deploy:hamidian-deploy` و mode آن را 0600 قرار دهید. خروجی
`id hamidian-deploy` را بررسی کنید: عضویت در `sudo`، `docker` یا
`hamidian-backup` غیرمجاز است. کلید production را فقط برای این workflow
نگه دارید؛ در staging یک حساب/کلید مستقل نیاز است.

در Settings → Environments → `production`، فقط شاخه main را مجاز کنید؛
برای شروع می‌توانید required reviewers فعال بگذارید. در Settings →
Secrets and variables → Actions این موارد را **بعد از آماده‌شدن staging و
production** تنظیم کنید:

| نام                          | محل      | مقدار                                                                                               |
| ---------------------------- | -------- | --------------------------------------------------------------------------------------------------- |
| `PRODUCTION_SSH_HOST`        | variable | IP یا hostname SSH سرور                                                                             |
| `PRODUCTION_SSH_USER`        | variable | `hamidian-deploy`                                                                                   |
| `PRODUCTION_SSH_KEY`         | secret   | کلید خصوصی اختصاصی deploy                                                                           |
| `PRODUCTION_SSH_KNOWN_HOSTS` | secret   | خط host key تأییدشده از کنسول VPS، با همان host درج‌شده در variable؛ هیچ `StrictHostKeyChecking=no` |
| `PRODUCTION_DEPLOY_ENABLED`  | variable | فقط **پس از** موفقیت VPS-010/011 مقدار `true`                                                       |

کلید host را با fingerprint ارائه‌دهنده/کنسول امن تأیید کنید؛ خروجی
`ssh-keyscan` تأیید امنیتی محسوب نمی‌شود. secretها را در تنظیمات GitHub
نگه دارید؛ `production.env` تنها روی VPS در `/etc/hamidian-silver` می‌ماند.

## ترتیب انتشار، سلامت و محدودیت دیسک ۵۰ GB

اسکریپت نصب‌شده، نه فایل اجرایی داخل release، با root اجرا می‌شود. SHA ورودی
سخت‌گیرانه اعتبارسنجی می‌شود؛ آرشیو فقط در مسیر root-owned
`/opt/hamidian-silver/releases/<SHA>` استخراج می‌شود و symlink، مسیر بیرونی،
فایل خاص و فایل بزرگ را رد می‌کند. برای deploy هم‌زمان lock میزبان وجود
دارد و اجرای جدید main deployment فعلی را cancel نمی‌کند.

1. سلامت media، env، نسخهٔ فعلی و سرویس‌های فعال بررسی می‌شود؛ image هر
   سرویس فعلی برچسب می‌خورد تا در rollback بماند.
2. قبل از deploy فقط build cache قدیمی و imageهای dangling بدون استفاده
   پاک می‌شوند؛ حداقل ۱۰ GiB فضای خالی روی filesystemهای مهم باید بماند.
3. VPS-007 بکاپ جدید همراه آزمون restore می‌گیرد؛ با شکست آن، migration و
   تغییر سرویس‌ها متوقف می‌شوند. حداقل فضای کافی برای همین آزمون جداگانه
   محاسبه می‌شود.
4. imageهای migrate/API/Storefront/Admin با tag همان SHA ساخته می‌شوند؛
   **فقط `prisma migrate deploy`** در کانتینر migrate اجرا می‌شود.
5. Compose منتظر health سرویس‌ها می‌ماند، سپس سه endpoint از طریق TLS و
   Nginx لوکال بررسی می‌شوند؛ فقط پس از موفقیت، symlinkهای `current` و
   `previous` جابه‌جا می‌شوند. با شکست سلامت، اسکریپت برگرداندن **اپلیکیشن**
   قبلی را امتحان می‌کند و خطا می‌دهد؛ دیتابیس را خودکار restore نمی‌کند.
6. پس از موفقیت، فقط releaseهای SHAدارِ منسوخ و imageهای SHAدارِ غیرجاری
   این پروژه حذف می‌شوند؛ cache و dangling imageها دوباره بررسی و فضای
   آزاد دوباره کنترل می‌شود. نسخهٔ فعلی و **یک نسخهٔ قبلی** باقی می‌مانند.

این طرح **هرگز** `docker system prune`، `docker image prune -a`، پاک‌کردن
Docker volumeها، دو بکاپ تأییدشده یا
`/var/lib/hamidian-silver/media` را اجرا نمی‌کند. فایل release حذف‌شده از
Git قابل بازیابی است؛ imageها دوباره build می‌شوند. checkout قدیمی خارج از
`releases/` خودکار پاک نمی‌شود: تعیین مالکیت و امکان حذف آن دستی است. با
کمبود فضای واقعی متوقف شوید و خروجی `docker system df`, `df -h` و اندازهٔ
بکاپ‌ها را بررسی کنید؛ حذف بی‌هدف داده مجاز نیست.

Migration ممکن است با نسخهٔ قدیمی اپ سازگار نباشد؛ پیش از merge هر تغییر
schema، مهاجرت **سازگار با نسخه قبلی** را تضمین و restore rehearsal را در
staging انجام دهید. rollback اپ به معنی rollback دیتابیس، سفارش یا پرداخت
نیست. `main` را صرفاً پس از بازبینی تغییرات migration به production وصل کنید.

برای غیرفعال‌کردن فوری deploy خودکار، variable
`PRODUCTION_DEPLOY_ENABLED` را به `false` تغییر دهید؛ سپس مشکل را بررسی کنید.
در حادثه، آخرین SHA و مسیرها را فقط بخوانید:

```bash
sudo readlink -f /opt/hamidian-silver/current
sudo readlink -f /opt/hamidian-silver/previous
sudo docker compose --project-directory /opt/hamidian-silver/current --env-file /etc/hamidian-silver/production.env -f /opt/hamidian-silver/current/compose.production.yaml ps
sudo df -h / /var/lib/hamidian-silver/media /var/backups/hamidian-silver /var/lib/docker
```

منابع: [GitHub Actions environments](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments)،
[Docker Compose up و wait](https://docs.docker.com/reference/cli/docker/compose/up/)،
[Docker builder prune](https://docs.docker.com/reference/cli/docker/builder/prune/)،
[Prisma migrate deploy](https://docs.prisma.io/docs/orm/prisma-client/deployment/deploy-database-changes-with-prisma-migrate).
