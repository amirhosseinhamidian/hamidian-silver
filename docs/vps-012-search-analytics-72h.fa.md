# VPS-012 — فعال‌سازی آنلاین SEO/Analytics و پایش ۷۲ ساعت اول

این patch **نه Search Console/GA4 را فعال می‌کند، نه به VPS متصل می‌شود، نه
شروع ۷۲ ساعت را اعلام می‌کند**. کامیت و پوش VPS-011 اثبات انتشار production
نیست. ابتدا صورت‌جلسهٔ بدون اطلاعات شخصیِ VPS-010 (OTP واقعی و پرداخت موفق
sandbox) و VPS-011 (HTTPS، backup+restore، محتوای واقعی و یک پرداخت کم‌مبلغ
واقعی با تطبیق سفارش و درگاه) باید نزد مالک ثبت شده باشد. اگر هر کدام
انجام نشده، این مرحله **NO-GO** است. `PRODUCTION_DEPLOY_ENABLED` را تا
موفقیت VPS-011 روشن نکنید.

## ۱. قبل از معرفی سایت به موتور جستجو

از دستگاهی **خارج از VPS** و بدون Basic Auth، سلامت عمومی دامنه‌ها را
بررسی کنید؛ این مرحله با بررسی loopback در smoke VPS-011 فرق دارد. دستور
زیر روی سیستم محلی فقط به سایت عمومی GET می‌فرستد و نیازمند Node/pnpm
پروژه است:

```bash
SEO_AUDIT_ORIGIN=https://hamidian.shop pnpm seo:audit
```

این ممیزی `/robots.txt`، `/sitemap.xml`، canonical صفحهٔ اصلی/محصولات/
برندها، یک محصول واقعی در sitemap، JSON-LD و خروج‌نکردن مسیرهای خصوصی را
بررسی می‌کند. در صورت خطا ابتدا همان مشکل را برطرف کنید؛ صرف ارسال sitemap
آن را حل نمی‌کند. آدرس `https://hamidian.shop/sitemap.xml` باید عمومی و
HTTPS باشد؛ staging و دامنهٔ `admin` نباید در sitemap تولید باشند. نمونهٔ
واقعی دسته‌بندی/برند/محصول، redirect دامنهٔ `www`، پاسخ ۴۰۴ و صفحات
noindex حساب، checkout و پرداخت را دستی هم چک کنید. برای ممیزی محتوا از
SF-FINAL-05 و برای canonical و تغییر slug از
`docs/seo-production-audit.md` استفاده کنید. بدون قیمت و موجودی واقعی،
نتیجهٔ HTTP سبز به معنی قابل‌انتشار بودن محتوا نیست.

## ۲. Search Console؛ عمل توسط مالک DNS/حساب Google

در Search Console یک **Domain property** برای `hamidian.shop` بسازید و TXT
تأیید مالکیت را فقط در پنل DNS خودتان ثبت کنید؛ مقدار TXT عمومی است ولی
دسترسی DNS را به دیگران ندهید. رکورد را پس از Verify حذف نکنید. این property
زیر‌دامنه‌ها از جمله staging را نیز شامل می‌شود؛ noindex staging و Basic
Auth VPS-010 باید سر جای خود باشند. اگر گزارش مخصوص سایت اصلی می‌خواهید،
یک URL-prefix property مستقل برای `https://hamidian.shop/` هم بسازید.
برای **URL-prefix property** تأیید HTML اختیاری است:
`GOOGLE_SITE_VERIFICATION` فقط در env خصوصی VPS قابل تنظیم است؛ این روش
جایگزین DNS در Domain property نیست. تغییر آن نیاز به اعمال مجدد runtime
Storefront دارد. از گذاشتن token در Git پرهیز کنید.

بعد از Verify، sitemap بالا را در Sitemaps ثبت کنید و با URL Inspection
صفحهٔ اصلی، یک محصول واقعی، دسته و برند را ببینید؛ canonical انتخابی و
indexability را با آنچه برنامه اعلام می‌کند مقایسه کنید. ممکن است داده‌ها
با تأخیر ظاهر شوند؛ **نبود گزارش در چند ساعت نخست، خطای خودکار انتشار
نیست**. Search Console به‌تنهایی رتبه یا ایندکس‌شدن فوری را تضمین نمی‌کند.

## ۳. GA4؛ گیت حریم خصوصی پیش از گذاشتن Measurement ID

پچ حاضر event جستجو را همچنان ثبت می‌کند اما مقدار آزاد تایپ‌شده توسط
کاربر را با مقدار ثابت `catalog` جایگزین می‌کند؛ تعداد نتیجه حفظ می‌شود.
page view تنها برای صفحات عمومی ثابت و با URL بدون query/fragments فرستاده
می‌شود؛ page view صفحات حساب، پرداخت و مسیرهای ناشناخته حذف شده است.
در عوض گزارش search term واقعی یا تفکیک page view برای هر slug نداریم؛
`view_item` شناسهٔ کالا را به‌صورت ساختاریافته همچنان ثبت می‌کند. مقادیر
GA4 در ریال (`IRR`) هستند، نه تومان. این محافظت برای داده‌ای است که
**کد خودمان** می‌فرستد و جانشین بازبینی دادهٔ واقعی شبکه نیست.

در GA4 → Admin → Data streams، پیش از فعال‌سازی ID، **Enhanced measurement**
را برای این stream خاموش کنید، به‌ویژه Site search (`q`)، page views ناشی
از browser history، outbound clicks و form interactions؛ Google ممکن است
از URL/فرم دادهٔ اضافه جمع‌آوری کند. در تنظیمات Google tag هر automatic
event مرتبط با URL/form را نیز کنترل کنید. فقط شناسهٔ stream خودتان با
قالب `G-...` را در `NEXT_PUBLIC_GA_MEASUREMENT_ID` در
`/etc/hamidian-silver/production.env` قرار دهید، نه مقدار ساختگی و نه در
Git. این متغیر **build-time** است: طبق گردش VPS-009 پس از review/CI یک
نسخهٔ جدید Storefront build/deploy کنید؛ صرف restart API آن را فعال نمی‌کند.
اگر VPS-011 هنوز کامل نیست، مقدار env را خالی نگه دارید.

بعد از فعال‌سازی، در مرورگر با ابزار Network و پنل GA4 DebugView/Realtime
با دادهٔ ساختگیِ غیرشخصی یک بار جستجو، محصول، wishlist، سبد و checkout
آزمایش کنید. برای purchase فقط همان پرداخت واقعی **که در VPS-011 با اجازهٔ
مالک انجام می‌شود** را مشاهده کنید؛ این مرحله پرداخت دوم ایجاد نمی‌کند.
تعداد `purchase` برای آن تراکنش یک‌بار، مبلغ ریال و `transaction_id` با
سفارش تطبیق داشته باشد؛ no URL query، OTP، تلفن، ایمیل یا نشانی نباید در
requestهای GA یا report دیده شود. یک جستجوی ساختگی به‌شکل شمارهٔ تلفن و
URL دارای query آزمایشی هم از نظر خروجی شبکه چک کنید. اگر اطلاعات خصوصی
یا event خودکار ناخواسته دیده شد، GA را با حذف ID و **rebuild** خاموش
کنید و قبل از ادامه علت را رفع کنید. ارسال داده به Google ممکن است نیازمند
بازبینی متن حریم خصوصی و تعهدات قراردادی شما باشد؛ متن فعلی را مالک
بازبینی کند.

## ۴. پایش ۷۲ ساعت پس از **راه‌اندازی واقعی**

زمان شروع UTC را پس از go-live واقعی ثبت کنید، نه زمان commit. هر دو timer
VPS-007/008 باید فعال باشند، یک بکاپ شامل DB و media با restore موفق و یک
نسخهٔ دانلودشده/تأییدشده روی مک داشته باشید. webhook هشدار بیرونی را با
`monitor-production.py --self-test-alert` آزمایش کنید. پایش از داخل VPS
قطع کامل آن را تشخیص نمی‌دهد: uptime check مستقل از **خارج VPS** برای
`https://api.hamidian.shop/api/v1/health/ready` و صفحهٔ اصلی با گیرندهٔ
هشدار واقعی تنظیم کنید؛ رمز و اطلاعات سفارش به سرویس ثالث نفرستید.

از checkout معتبر روی VPS اسکریپت مشاهده را پس از مقایسه با نسخهٔ نصب‌شده
نصب کنید؛ فقط خروجی خلاصه می‌دهد و فایل/داده‌ای پاک نمی‌کند:

```bash
sudo install -o root -g root -m 0755 deploy/observe-launch.sh /usr/local/libexec/hamidian-silver/observe-launch.sh
sudo /usr/local/libexec/hamidian-silver/observe-launch.sh
```

خروجی را با زمان UTC **۰، ۶، ۱۲، ۲۴، ۴۸ و ۷۲ ساعت** در یادداشت خصوصی ثبت
کنید. اسکریپت سلامت سه دامنه و ۴۰۴/رسانه (smoke VPS-011)، فعال‌بودن timerها،
وضعیت آخرین اجرای بکاپ/مانیتور، تازگی بکاپ کمتر از ۳۰ ساعت و حداقل ۱۲ GiB
فضای آزاد روی فایل‌سیستم‌های مهم را بررسی می‌کند. در هر نوبت خودتان نیز
این موارد را مرور کنید:

| زمان       | بررسی دستی افزون بر اسکریپت                                                                           |
| ---------- | ----------------------------------------------------------------------------------------------------- |
| ۰–۶ ساعت   | alert webhook و uptime بیرونی، درخواست‌های ۵xx، سلامت OTP/درگاه، سفارش واقعی و queue تسویه/ارسال دستی |
| ۱۲–۲۴ ساعت | بکاپ و restore نوبت بعد، checksum نسخهٔ Mac، مغایرت سفارش/پرداخت و رفتار GA4 Realtime                 |
| ۴۸ ساعت    | روند خطا/فضا/سلامت سرویس، Google Search Console Page indexing و نتیجهٔ sitemap اگر پردازش شده         |
| ۷۲ ساعت    | تأیید ۷۲ ساعت پیوستهٔ monitor/uptime، بکاپ‌های قابل‌restore، نبود رخداد مالی باز، ثبت مسئول پایش بعدی |

اگر یک هشدار critical، پاسخ ۵xx تکرارشونده، بکاپ ناموفق، کمبود دیسک،
ناهماهنگی پرداخت یا نشت اطلاعات به GA رخ داد، بازه را «موفق» اعلام نکنید:
فروش/درگاه را طبق راهنمای incident کنترل کنید، deploy خودکار را موقتاً
غیرفعال و علت را رفع کنید. script مشاهده و Search Console **تضمین‌کنندۀ
سفارش یا تشخیص خرابی کامل VPS نیستند**. خاموش‌کردن monitor، حذف backup،
volume، media یا image لازم برای rollback راه‌حل کمبود فضا نیست؛ cleanup
امن VPS-009 قبل/بعد از هر deploy انجام می‌شود. با قبولی همهٔ گیت‌ها، این
مرحله پایان رودمپ است؛ پس از آن پایش روزمره و ممیزی دوره‌ای ادامه دارد.

منابع: [Search Console Domain property](https://support.google.com/webmasters/answer/34592)،
[ثبت sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)،
[Enhanced measurement در GA4](https://support.google.com/analytics/answer/9216061)،
[page view دستی GA4](https://developers.google.com/analytics/devguides/collection/ga4/views).
