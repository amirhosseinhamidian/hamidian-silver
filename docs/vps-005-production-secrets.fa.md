# VPS-005 — env و secretهای production خارج از Git

این مرحله برای `hamidian.shop` روی همان VPS با Ubuntu 24.04 و دیسک ۵۰ GB است.
تنها نسخهٔ واقعی پیکربندی برنامه در `/etc/hamidian-silver/production.env`
روی **خود VPS** و بیرون از checkout/release قرار می‌گیرد. فایل نمونهٔ
`deploy/production.env.example` هیچ رمز واقعی ندارد. این patch نه به سرور
وصل می‌شود، نه رمز می‌سازد، نه پرداخت یا SMS واقعی را فعال می‌کند. راهنمای
VPS-004 (DNS، HTTPS و firewall) باید مستقل بررسی شده باشد.

## ۱. تهیهٔ فایل، بدون بازنویسی secret قبلی

از ریشهٔ پروژه روی VPS، ابتدا فایل و مجوز پوشه را **بدون نمایش محتوا** چک کنید:

```bash
sudo ls -ld /etc/hamidian-silver /etc/hamidian-silver/production.env
```

اگر قبلاً فایل ساخته‌اید، آن را با نمونه **جایگزین نکنید**؛ پس از بررسی، فقط
کلیدهای جاافتاده را با ویرایشگر امن تکمیل کنید. اگر فایل وجود ندارد و symlink
هم نیست، برای ایجاد اولیه (و فقط یک‌بار):

```bash
sudo install -d -o root -g root -m 0700 /etc/hamidian-silver
sudo test ! -e /etc/hamidian-silver/production.env && sudo test ! -L /etc/hamidian-silver/production.env && sudo install -o root -g root -m 0600 deploy/production.env.example /etc/hamidian-silver/production.env
sudoedit /etc/hamidian-silver/production.env
```

اگر شرط دستور دوم برقرار نبود، اجرای آن باید متوقف شود؛ این محافظ برای
جلوگیری از بازنویسی فایل موجود است. اگر `sudoedit` با ویرایشگر مورد نظر شما
باز نشد، تنظیم ویرایشگر را در همان ترمینال انجام دهید؛ محتوای فایل را در
خروجی ترمینال یا مکالمه کپی نکنید. `umask 077` را برای نشست مدیریتی انتخاب
کنید و برای فایل‌های موقتی و بکاپ نیز از دسترسی محدود استفاده کنید. هیچ
credentialای را به `deploy/production.env.example` یا `.env` داخل Git کپی
نکنید؛ `production.env` محلی در `.gitignore` محافظت تکمیلی دارد، نه جایگزین
قرار دادن فایل خارج از checkout.

## ۲. مقدارهای واقعی و ترتیب فعال‌سازی

برای ساخت دو مقدار **مستقل** روی سیستم خودتان/ترمینال امن اجرا کنید و آنها را
فقط در فایل خصوصی وارد کنید:

```bash
openssl rand -hex 32
openssl rand -hex 32
```

اولی `POSTGRES_PASSWORD` و دومی `OTP_PEPPER` است. خروجی را در تاریخچهٔ
فرمان‌ها، پیام‌رسان، Git یا issue ذخیره نکنید. رمز PostgreSQL را در
`DATABASE_URL=postgresql://hamidian:<PASSWORD>@postgres:5432/hamidian_silver?schema=public`
همان‌طور **یکسان** قرار دهید. برای رمز hex بالا تبدیل اضافه لازم نیست؛
اگر قبلاً رمز دارای کاراکتر ویژه گذاشته‌اید، بخش password در URL را
percent-encode کنید. `POSTGRES_USER`/`POSTGRES_DB` باید با URL و مقادیر
نصب اولیه PostgreSQL برابر باشند. env در Compose فایل shell نیست؛
از الگوی سادهٔ `KEY=VALUE` بدون نقل‌قول و `$` استفاده کنید.

| مرحله              | تنظیم                                                 | شرط                                                                                                                                                                                      |
| ------------------ | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| آماده‌سازی زیرساخت | `SMS_PROVIDER=disabled` و `PAYMENT_PROVIDER=disabled` | خرید واقعی هنوز مجاز نیست؛ OTP ارسال نمی‌شود.                                                                                                                                            |
| پیش از فروش        | `SMS_PROVIDER=kavenegar`                              | `KAVENEGAR_API_KEY` و `KAVENEGAR_OTP_TEMPLATE` واقعی و آزموده‌شده؛ `KAVENEGAR_SENDER` فقط در صورت نیاز. `console` در production ممنوع است.                                               |
| اولین درگاه واقعی  | فقط اعتبارنامهٔ **یک** درگاه                          | برای زرین‌پال `ZARINPAL_MERCHANT_ID` و هنگام پرداخت واقعی `ZARINPAL_SANDBOX=false`؛ زیبال یا ملت هم امکان‌پذیرند ولی هم‌زمان چند درگاه را فعال نکنید.                                    |
| تنظیم مالی در پنل  | درگاه را در تنظیمات پنل/دیتابیس فعال کنید             | `PAYMENT_PROVIDER` یک flag قدیمی است و فعال‌کردن آن **جای** فعال‌سازی در پنل را نمی‌گیرد؛ در این استقرار روی `disabled` بماند. اول پرداخت کم‌مبلغ واقعی و برگشت callback را آزمایش کنید. |
| ارسال کالا         | `SHIPPING_PROVIDER=disabled`                          | Postex خاموش؛ `MANUAL_SHIPPING_COST_TOMAN=0` برای رایگان یا مبلغ ثابت به تومان.                                                                                                          |

`MEDIA_PUBLIC_BASE_URL`، `CORS_ORIGINS` و `PAYMENT_CALLBACK_URL` دقیقاً باید
مقادیر HTTPS داخل نمونه باشند؛ پیکربندی رسانه و گواهی دامنهٔ media هم باید
فعال باشد. `NEXT_PUBLIC_GA_MEASUREMENT_ID` شناسهٔ عمومی است، secret نیست؛
تغییر آن یا سایر مقادیر build-time به rebuild اپ Storefront نیاز دارد. کلید
SMS و درگاه هرگز در `NEXT_PUBLIC_*` یا build args قرار نمی‌گیرند.

**نکتهٔ دیتابیس موجود:** تغییر `POSTGRES_PASSWORD` در Compose روی volume
PostgreSQL که قبلاً init شده رمز نقش موجود را عوض نمی‌کند. اگر قبلاً دیتابیس
داده‌دار روی VPS دارید، **رمز جدید را بی‌برنامه جایگزین نکنید**؛ ابتدا بکاپ
معتبر و روند rotate رمز همراه با هماهنگ‌کردن `DATABASE_URL` را آماده کنید.

## ۳. کنترل بدون افشای secret

روی VPS، از ریشهٔ checkout، بعد از ذخیره فایل خصوصی:

```bash
sudo python3 deploy/validate-production-env.py /etc/hamidian-silver/production.env
sudo docker compose --env-file /etc/hamidian-silver/production.env -f compose.production.yaml config --quiet
```

بررسی اول file mode/owner، نبود symlink، ساختار کلیدها، همسانی رمز/URL،
دامنه‌های درست و غیر فعال بودن ارسال `console` یا Postex را می‌سنجد؛ فقط نام
فیلد معیوب را می‌گوید، نه مقدارش را. `config --quiet` syntax Compose را
کنترل می‌کند. **از `docker compose config` بدون `--quiet` یا
`config --environment` استفاده نکنید**؛ خروجی resolved ممکن است رمزها را
نشان دهد. اگر متغیرهای هم‌نام در shell حاضر باشند، Compose ممکن است آنها را
بر `--env-file` مقدم بداند؛ قبل از اجرای deploy از پاک‌بودن محیط اجرا مطمئن
شوید. هر حساب دارای دسترسی root یا Docker daemon می‌تواند env کانتینر را
بخواند؛ دسترسی گروه `docker` را به افراد نامطمئن ندهید.

در محیط توسعه، بدون خواندن فایل خصوصی VPS، تست validator را **خودتان** با
دادهٔ ساختگی اجرا کنید:

```bash
python3 -m unittest discover -s deploy -p 'test_validate_production_env.py'
```

فعال‌سازی کانتینرها و migration فقط بعد از عبور این کنترل‌ها و طبق VPS-002
انجام شود (`prisma migrate deploy`، نه `migrate dev`). اتصال واقعی SMS،
درگاه، داده‌های ادمین و تست خرید شرط مرحلهٔ staging/go-live هستند؛ یک
validator سبز به معنای آماده‌بودن فروش نیست. در VPS-009 GitHub Actions فقط
روی push به `main` با دسترسی محدود deploy خواهد کرد و **فایل production.env
همچنان روی VPS** می‌ماند؛ مقدار آن وارد GitHub Actions نمی‌شود. media و
بکاپ‌های قابل دانلود روی همان VPS هستند؛ حفاظت، نگهداری و تست restore بکاپ‌ها
در VPS-007 تکمیل می‌شود. بررسی دیسک و پاک‌سازی امن imageها قبل/بعد deploy
نیز طبق VPS-003 به VPS-009 موکول شده است.

منابع: [قواعد env و تقدم shell در Docker Compose](https://docs.docker.com/compose/how-tos/environment-variables/variable-interpolation/)،
[نکات امنیت secret در Docker Compose](https://docs.docker.com/compose/how-tos/use-secrets/).
