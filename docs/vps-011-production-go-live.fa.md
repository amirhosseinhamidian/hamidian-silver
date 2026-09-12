# VPS-011 — انتشار نخست production و smoke کنترل‌شده

این مرحله فایل‌های انتشار را آماده می‌کند؛ **خودِ patch هیچ کاری روی VPS،
درگاه، DNS یا GitHub انجام نمی‌دهد.** مبنا `frontend-v2` است. کامیت و پوش
VPS-010 معادل اجرای موفق staging نیست. تا وقتی تمام بندهای بخش ۱ با آزمون
واقعی و نتیجهٔ قابل‌بررسی ثبت نشده‌اند، **دستورهای بخش ۳ و پس از آن را اجرا
نکنید**. `PRODUCTION_DEPLOY_ENABLED` باید `false` بماند.

## ۱. گیت انسانی قبل از هر تغییر production

مالک پروژه زمان UTC، SHA اجراشده در staging و فقط شناسهٔ سفارش آزمایشی
(بدون شماره، OTP، آدرس، رمز یا token) را در یادداشت خصوصی خودش ثبت کند:

- workflow `verify` همان SHA سبز، HTTPS staging و Basic Auth و سلامت آن؛
- ورود OTP واقعاً ارسالی Kavenegar به شمارهٔ خود، سبد و checkout با کالای
  demo و ارسال دستی؛
- **یک پرداخت موفق sandbox زرین‌پال** از مسیر بازگشت HTTPS staging و تطابق
  وضعیت payment attempt و سفارش در پنل؛ مسیر pending/unknown نیز موفقیت کاذب
  نشان ندهد؛
- restore آزمایشیِ بکاپ و E2E موبایل/دسکتاپ بدون دست‌زدن به دادهٔ production؛
- فهرست محتوای واقعی، قیمت/موجودی، سیاست‌ها، شماره‌ها و تصاویر برای انتشار
  مطابق SF-FINAL-05 بررسی شده باشد.

اگر یکی از این‌ها انجام نشده، وضعیت **NO-GO** است: در صورت نیاز staging را
تکمیل کنید و نتایج غیرحساس را گزارش دهید. تست Playwright با API ساختگی،
تست sandbox واقعی نیست. این گیت خوداظهاریِ مالک است، نه تأیید خودکار پرداخت.

## ۲. چک‌لیست قبل از ورود به پنجرهٔ انتشار

فقط پس از گیت بالا، پنجرهٔ کم‌ترافیک و فرد مسئول incident/rollback تعیین
کنید. وضعیت GitHub Actions و تطابق SHA بین کد مستقر و `main` آینده را
مستقل کنترل کنید. هرگز برای اولین راه‌اندازی مستقیماً push به `main` را
به‌عنوان روش deploy به کار نبرید: `deploy-production.sh` به `current` سالم،
بکاپ و سرویس‌های در حال اجرا نیاز دارد. staging و production volume، رسانه،
secrets و پورت مجزا دارند؛ برای آزادسازی RAM فقط طبق VPS-010 staging را
`stop` کنید، نه `down -v`.

روی VPS، از checkout مورداعتمادِ root-owned که
`/opt/hamidian-silver/current` به آن اشاره می‌کند (VPS-007/009)، فقط این
بررسی‌های بدون تغییر را انجام دهید:

```bash
sudo readlink -f /opt/hamidian-silver/current
sudo ls -ld /opt/hamidian-silver /opt/hamidian-silver/current /var/lib/hamidian-silver/media /var/backups/hamidian-silver
sudo df -h / /var/lib/docker /var/lib/hamidian-silver/media /var/backups/hamidian-silver
sudo docker system df
sudo ss -lntp
sudo nginx -t
sudo /usr/local/libexec/hamidian-silver/check-production-media.sh
```

مقصد `current` و والدهای آن باید root-owned و غیرقابل‌نوشتن برای کاربران
غیرمجاز باشند؛ اگر قبلاً کانتینر production، volume یا داده وجود دارد،
**bootstrap اولیه را تکرار نکنید**؛ سناریوی ارتقا و بکاپ را بررسی کنید.
PostgreSQL/Redis نباید host port داشته باشند، سه پورت 3100–3102 فقط
`127.0.0.1` باشند. روی دیسک ۵۰ GB بعد از توقف staging و قبل از build حداقل
۱۴ GiB فضای خالی، و پیش/پس از migration حداقل ۱۰ GiB باقی بماند. اگر جا
نیست، توقف؛ media، volume، بکاپ یا image لازمهٔ rollback را پاک نکنید.

با دیدن محتوای واقعی secrets یا خطاهای مالی در خروجی، آن را اینجا/در Git
منتشر نکنید. `production.env` باید طبق VPS-005 معتبر و root:root 0600
باشد؛ رمز/کلید SMS/درگاه را وارد env داخل ریپو یا آرگومان CLI نکنید. برای
اولین بالا آمدن `SMS_PROVIDER=disabled`، `PAYMENT_PROVIDER=disabled` و
`SHIPPING_PROVIDER=disabled`، و تنها بعد از گیت‌ها SMS واقعی و یک درگاه
واقعی فعال می‌شود. گواهی چهار دامنهٔ `hamidian.shop`،
`api.hamidian.shop`، `admin.hamidian.shop` و `media.hamidian.shop` باید
درست و قابل‌تأیید باشد؛ `curl -k` راه‌حل خطای TLS نیست.

## ۳. نصب فایل میزبان و bootstrap دادهٔ **واقعی**؛ فقط در نصب اولیه

ابتدا diff فایل نصب‌شده با نسخهٔ پروژه و مجوزهای آن را بررسی کنید؛ فرمان
`install` را روی فایل‌های دست‌کاری‌شده/نامطمئن کورکورانه اجرا نکنید. سه
فیلد bootstrap فقط روی VPS و خارج Git، در فایل خصوصی جدا هستند؛ هیچ
اعتبارنامه‌ای در این فایل نیست. نصب اولیه **فقط اگر فایل قبلاً وجود ندارد**:

```bash
sudo install -o root -g root -m 0755 deploy/smoke-production.sh deploy/check-production-bootstrap-env.py deploy/validate-production-env.py /usr/local/libexec/hamidian-silver/
sudo test ! -e /etc/hamidian-silver/production-bootstrap.env && sudo test ! -L /etc/hamidian-silver/production-bootstrap.env && sudo install -o root -g root -m 0600 deploy/production-bootstrap.env.example /etc/hamidian-silver/production-bootstrap.env
sudoedit /etc/hamidian-silver/production-bootstrap.env
sudo /usr/local/libexec/hamidian-silver/validate-production-env.py
sudo /usr/local/libexec/hamidian-silver/check-production-bootstrap-env.py
```

`OPERATIONAL_ADMIN_PHONE` شمارهٔ واقعی تحت کنترل شما، `OPERATIONAL_CONTACT_ADDRESS`
و `OPERATIONAL_CONTACT_PHONES` اطلاعات عمومیِ بازبینی‌شده باشند. اگر فایل
از قبل موجود است، نصب اولیه را رد کنید و محتوا را خصوصی بازبینی کنید.
در shell یا `--env-file` دوم نباید `SEED_DEMO_CATALOG`،
`OPERATIONAL_PAYMENT_GATEWAY` یا کلید درگاه باشد؛ validator آن‌ها را رد
می‌کند. خود Compose هم demo و gateway را صراحتاً غیرفعال می‌کند.

دستورهای زیر **روی VPS و فقط پس از گیت staging**، داخل نشست root مدیریتی
از checkout سالم اجرا می‌شوند؛ هنگام خطا همان‌جا متوقف و علت را بررسی
کنید. `config --quiet` را بدون `--quiet` جایگزین نکنید چون ممکن است secret
نمایش دهد. اگر current به commit دیگری اشاره می‌کند یا خدمات production
از قبل فعال‌اند، این سناریوی نصب تازه مناسب نیست:

```bash
sudo -i
set -euo pipefail
cd /opt/hamidian-silver/current
test "$(stat -c %u .)" = 0
test -f compose.production.yaml
production_compose() {
  env -i HOME=/root PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin \
    docker compose --project-directory "$(pwd -P)" --env-file /etc/hamidian-silver/production.env -f compose.production.yaml "$@"
}
seed_compose() {
  env -i HOME=/root PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin \
    docker compose --project-directory "$(pwd -P)" --env-file /etc/hamidian-silver/production.env \
    --env-file /etc/hamidian-silver/production-bootstrap.env -f compose.production.yaml "$@"
}
production_compose config --quiet
seed_compose config --quiet
docker builder prune --force --filter until=72h --keep-storage=2GB
docker image prune --force --filter until=72h
df -h /var/lib/docker /var/backups/hamidian-silver
production_compose up -d --wait --wait-timeout 240 postgres redis
production_compose build migrate
production_compose run --rm migrate
seed_compose build seed
seed_compose run --rm seed
df -h /var/lib/docker /var/backups/hamidian-silver
production_compose build api storefront admin
production_compose up -d --no-build --wait --wait-timeout 240 api storefront admin
production_compose ps
/usr/local/libexec/hamidian-silver/smoke-production.sh
```

`migrate` فقط `prisma migrate deploy` اجرا می‌کند؛ روی VPS هرگز
`migrate dev` اجرا نکنید. seed فقط نقش‌ها/مجوزها، ادمین اصلی، انبار، صفحات
پیش‌فرض و اطلاعات تماس واقعی را می‌سازد؛ کالاهای demo اضافه نمی‌کند و
هیچ درگاهی را فعال نمی‌کند. عکس، کالا، موجودی، برند و محتوای نهایی را از
پنل طبق SF-FINAL-05 بازبینی/وارد کنید و بعد دوباره `smoke-production.sh`
بگیرید. اگر seed یا migration شکست خورد، دسترسی فروش را باز نکنید؛ DB را
با `migrate resolve` کورکورانه تغییر ندهید. اگر shell قطع شد، قبل از
تکرار هر مرحله وضعیت Compose و migration و موجودیت‌ها را بررسی کنید.
**بعد از فعال‌کردن درگاه، seed اولیه را تکرار نکنید**: پیکربندی آن عمداً
همهٔ درگاه‌ها را به حالت disabled بازمی‌گرداند. برای تغییر دادهٔ عملیاتی از
پنل و runbook مخصوص همان عملیات استفاده کنید.

## ۴. بکاپ، آزمایش اتصال واقعی و گیت GO/NO-GO

پیش از پرداخت واقعی، backup+restore جداشدهٔ VPS-007 باید موفق شود؛ بکاپ
حتی روی دیسک همان VPS در خرابی دیسک محافظت نمی‌کند، بنابراین نسخهٔ تأییدشده
را طبق راهنمای VPS-007 روی مک دانلود و checksum را بررسی کنید. از همان
نشست root در checkout production:

```bash
/usr/local/libexec/hamidian-silver/backup-production.sh /opt/hamidian-silver/current
systemctl list-timers hamidian-silver-backup.timer
/usr/local/libexec/hamidian-silver/smoke-production.sh
df -h / /var/lib/docker /var/backups/hamidian-silver
docker system df
```

اگر restore، محتوای واقعی، HTTPS یا ظرفیت fail شد، **NO-GO**: درگاه را
فعال نکنید. سپس فقط با اختیار صریح مالک: `SMS_PROVIDER=kavenegar` با کلید
و template واقعی، و اعتبارنامهٔ فقط **یک** درگاه معتبر در
`production.env` تنظیم شوند (زرین‌پال واقعی: `ZARINPAL_SANDBOX=false`).
فایل خصوصی را دوباره validate کنید و سرویس API را با همان Compose و
`up -d --no-build --wait --wait-timeout 240 api` بازآفرینی کنید؛ پیش از
ادامه health را چک کنید. در پنل production همان **یک** درگاه را فعال و
Postex را غیرفعال نگه دارید. این تنظیم‌ها پرداخت ایجاد نمی‌کنند؛ با
اجازهٔ مالک **یک خرید کم‌مبلغ واقعی** توسط خودش انجام شود: OTP واقعی،
کالای واقعی، checkout، بازگشت TLS، تطبیق پرداخت/سفارش در پنل و وب‌سایت،
عدم ثبت purchase تکراری، وضعیت refund/reconciliation را کنترل کنید. هیچ
پرداختی را با اسکریپت smoke شبیه‌سازی یا trigger نکنید. برای callback
نامطمئن پول را موفق فرض نکنید و راهنمای incident/عملیات ادمین را به‌کار
بگیرید. بعد از آزمون، بکاپ+restore تأییدشدهٔ جدید بگیرید و آن را هم خارج
سرور نگه دارید.

## ۵. فعال‌سازی انتشار خودکار فقط پس از GO واقعی

پیش از هر merge، current سالم، بکاپ و restore تازه، نبود سرویسِ باز به
اینترنت برای DB/Redis، هشدارهای monitor، SHA و فضای دیسک را بررسی کنید.
مقدار `PRODUCTION_DEPLOY_ENABLED` را **فقط بعد از قبولی تمامی گیت‌های
بالا** به `true` تغییر دهید، SSH host key/کلید workflow و سیاست branch
`main` را مطابق VPS-009 کنترل کنید. در پلن GitHub شما، اگر required
reviewer در environment `production` در دسترس نبود، گیت دستی و محافظت
branch را به‌جای فرض وجود آن نگه دارید. push به main در این حالت **واقعاً
production را deploy می‌کند**؛ ابتدا یک تغییر غیرحساس و بدون migration
شکننده را با فرد مسئول پایش کنید.

اسکریپت VPS-009 پیش/پس از انتشار فقط cache قدیمی و dangling image، سپس
release/image منسوخِ کاملاً مشخص و بی‌استفادهٔ همین پروژه را حذف می‌کند؛
`docker system prune --volumes` یا حذف بکاپ و media در برنامه نیست. image
one-shot `hamidian-silver-seed:manual` را فقط بعد از bootstrap موفق، restore
تأییدشده و اتمام نیاز به اجرای مجدد seed می‌توان با بررسی نام دقیقش به‌شکل
دستی حذف کرد؛ اگر Docker بگوید هنوز استفاده می‌شود به‌اجبار حذف نکنید.
در ۲۴ ساعت اول سلامت و آمار ۵xx، alert دیسک، backlog سفارش و وضعیت درگاه
را با VPS-008 پایش کنید؛ پایش ۷۲ ساعت اول و Search Console موضوع VPS-012
است. rollback اپ خودکار VPS-009 **دیتابیس یا پرداخت را برنمی‌گرداند**؛
در خطای مالی خودکار restore production نزنید، deploy را خاموش و incident
را با متخصص رسیدگی کنید.

مراجع: [Compose up --wait](https://docs.docker.com/reference/cli/docker/compose/up/)،
[Prisma migrate deploy](https://www.prisma.io/docs/orm/prisma-client/deployment/deploy-database-changes-with-prisma-migrate)،
[GitHub deployment environments](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments).
