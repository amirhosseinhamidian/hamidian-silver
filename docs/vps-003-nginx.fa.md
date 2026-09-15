# VPS-003 — مسیریابی Nginx برای دامنهٔ Hamidian Silver

این مرحله config مربوط به Nginx نصب‌شده **روی خود میزبان VPS** را اضافه می‌کند؛
Nginx داخل Docker نیست. تا مرحلهٔ VPS-004 هیچ TLS/گواهی‌ای نداریم، بنابراین
config فعلی فقط روی `127.0.0.1:8080` گوش می‌دهد و نباید به `0.0.0.0:80`
یا `0.0.0.0:443` تغییر کند. ورود، پرداخت و پنل را تا بعد از TLS عمومی نکنید.

| Host در درخواست                       | مقصد Nginx روی میزبان | محدوده                                    |
| ------------------------------------- | --------------------- | ----------------------------------------- |
| `hamidian.shop` و `www.hamidian.shop` | `127.0.0.1:3101`      | کل فروشگاه؛ redirect دائمی www در VPS-004 |
| `admin.hamidian.shop`                 | `127.0.0.1:3102`      | پنل و BFFهای ادمین                        |
| `api.hamidian.shop`                   | `127.0.0.1:3100`      | فقط `/api/`؛ `/docs` بیرون از دسترس       |
| `media.hamidian.shop`                 | `127.0.0.1:3100`      | فقط GET/HEAD زیر `/media/`                |

پورت‌ها مطابق `compose.production.yaml` مرحلهٔ VPS-002 هستند؛ PostgreSQL و
Redis همچنان هیچ پورت میزبان ندارند. `proxy_pass` در media عمداً بدون `/` انتهایی
است تا `/media/…` عیناً به API برسد. Nginx درخواست‌های بزرگ‌تر از ۱۱ MiB را
در Admin/API رد می‌کند؛ خود برنامه حداکثر ۱۰ MiB فایل تصویر می‌پذیرد.
Nginx درخواست‌های host ناشناخته را رد می‌کند و در access log **query string**
را ثبت نمی‌کند تا پارامترهای callback در لاگ عادی ذخیره نشوند. دسترسی و نگهداری
امن error log و چرخش لاگ‌ها در VPS-008 بررسی می‌شود.

## نصب config، بدون فعال‌سازی HTTP عمومی

پس از نصب Nginx روی Ubuntu و قبل از فعال‌کردن config، هر فایل دیگری که روی
`127.0.0.1:8080` گوش می‌دهد را شناسایی کنید. پس از بررسی دستی فایل‌های موجود،
از ریشهٔ پروژه:

```bash
sudo install -m 0644 deploy/nginx/hamidian-silver-proxy.conf /etc/nginx/snippets/hamidian-silver-proxy.conf
sudo install -m 0644 deploy/nginx/hamidian-silver.conf /etc/nginx/sites-available/hamidian-silver.conf
sudo ln -s /etc/nginx/sites-available/hamidian-silver.conf /etc/nginx/sites-enabled/hamidian-silver.conf
sudo nginx -t
sudo systemctl reload nginx
```

اگر symlink از قبل وجود دارد، `ln -s` را دوباره اجرا نکنید. نسخهٔ نصب‌شدهٔ
config را در ویرایش‌های بعدی به‌روزرسانی و **فقط پس از `nginx -t` موفق** reload
کنید. فعال‌بودن سایت پیش‌فرض Nginx روی پورت عمومی ۸۰ به معنای فعال‌بودن این
برنامه نیست؛ برای VPS-004 باید HTTP عمومی، گواهی و redirect HTTPS به‌صورت
کنترل‌شده تنظیم شوند.

## بررسی لوکال روی VPS

این بررسی‌ها بعد از بالا آمدن Compose و وجود دادهٔ اولیه معنی دارند:

```bash
curl -i -H 'Host: api.hamidian.shop' http://127.0.0.1:8080/api/v1/health/ready
curl -i -H 'Host: hamidian.shop' http://127.0.0.1:8080/api/health
curl -i -H 'Host: admin.hamidian.shop' http://127.0.0.1:8080/api/health
curl -i -H 'Host: media.hamidian.shop' http://127.0.0.1:8080/docs
curl -i -H 'Host: api.hamidian.shop' http://127.0.0.1:8080/docs
curl -i -X POST -H 'Host: media.hamidian.shop' http://127.0.0.1:8080/media/example.webp
```

سه دستور اول باید پاسخ سالم بگیرند، `/docs` روی دامنه‌های media و API باید ۴۰۴
و POST رسانه باید ۴۰۳ باشد.
یک تصویر واقعی آپلودشده را نیز با Host مربوط به media در `/media/...` آزمایش
کنید؛ نبود تصویر باید ۴۰۴ بماند. هنگام اجرای این مرحله، DNS و گواهی ممکن است
هنوز آماده نباشند؛ تست‌ها با Host header انجام می‌شوند و به DNS وابسته نیستند.

## قرارداد مراحل بعدی: انتشار خودکار و پاک‌سازی دیسک

در VPS-009، workflow مربوط به GitHub Actions باید **فقط push به `main`** را
برای مسیر انتشار production در نظر بگیرد؛ از `frontend-v2` نباید استقرار
production آغاز شود. فعال‌شدن استقرار production به عبور از staging، آماده‌شدن
secretها و تایید اولین انتشار در VPS-010/011 وابسته است.

پیش و پس از هر deploy باید استفادهٔ واقعی دیسک، imageها، build cache و فایل‌های
release بررسی شود. پاک‌سازی فقط برای هدف‌های **شناخته‌شده و قابل‌بازیابی** انجام
می‌شود: قبل از انتشار حفظ imageهای فعال و نسخهٔ rollback؛ بعد از healthcheck
موفق، حذف artifactهای قدیمی همین پروژه طبق سیاست نگهداری. اگر healthcheck
ناموفق شد، rollback انجام و پاک‌سازی خطرناک متوقف شود. هیچ‌وقت volumeهای
PostgreSQL/Redis، `/var/lib/hamidian-silver/media`، بکاپ‌های VPS یا env/secretهای
خارج از Git پاک نشوند. دستوری مثل `docker system prune -a --volumes` راهکار
این سرور نیست. در صورت فضای ناکافی که نتوان به‌شکل امن آزاد کرد، pipeline باید
fail شود و هشدار بدهد، نه اینکه داده یا image لازم برای rollback را حذف کند.

پیاده‌سازی job، قفل هم‌زمانی deploy، نگهداری imageهای rollback و پاک‌سازی
قابل‌ممیزی در VPS-009 انجام خواهد شد؛ این patch هیچ deployment یا cleanup
خودکاری را فعال نمی‌کند.
