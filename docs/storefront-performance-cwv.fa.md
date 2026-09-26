# پایش Performance و Core Web Vitals فروشگاه

این سند مرجع بررسی Performance بعد از انتشار Storefront است. معیار نهایی، تجربه واقعی کاربران است و Lighthouse فقط ابزار تشخیصی آزمایشگاهی محسوب می‌شود.

## اهداف

| شاخص | هدف Good |
| --- | ---: |
| LCP | حداکثر 2.5 ثانیه |
| INP | کمتر از 200 میلی‌ثانیه |
| CLS | کمتر از 0.1 |
| TTFB | برای تشخیص bottleneck سرور پایش شود |

ارزیابی اصلی باید در صدک 75 کاربران و به تفکیک Mobile/Desktop انجام شود.

## بهینه‌سازی‌های فعلی

- Product price/stock بین کاربران cache نمی‌شود.
- درخواست یکسان catalog در یک render request dedupe می‌شود.
- Site Settings، Categories و Brands با TTL کوتاه 60 ثانیه cache می‌شوند.
- Shipping options فقط برای Structured Data صفحه Home تا 5 دقیقه cache می‌شود؛ مسیر checkout همچنان `no-store` است.
- `/categories` به جای force-dynamic با revalidate 60 ثانیه ارائه می‌شود.
- optimized imageهای Next برای mediaهای immutable تا 30 روز cache می‌شوند.
- فقط یک تصویر اصلی Product Gallery high-priority/preload است.
- اگر Collection Hero تصویر نداشته باشد، فقط اولین Product Card به عنوان کاندید LCP preload می‌شود.
- اولین تصویر هاب Categories preload می‌شود.
- GA4 event با نام `web_vital` برای LCP، INP، CLS و TTFB ارسال می‌شود.
- event فقط `page_path` بدون query string را ثبت می‌کند.

## بررسی بعد از Deploy

صفحات نماینده:

1. `/`
2. `/products`
3. یک Product Detail دارای چند تصویر
4. یک Category دارای Hero
5. یک Category بدون Hero
6. یک Brand
7. `/categories`

برای هر صفحه:

- PageSpeed Insights روی Mobile و Desktop.
- Chrome DevTools Performance برای LCP element و long taskهای INP.
- Network: فقط یک درخواست high-priority برای LCP image.
- Network: فونت‌ها و حجم واقعی TTF بررسی شود.
- Network: درخواست‌های API تکراری settings/categories/brands بررسی شود.
- Layout Shift Regions برای CLS بررسی شود.

## GA4

event: `web_vital`

پارامترها:

- `metric_name`
- `metric_value`
- `metric_delta`
- `metric_id`
- `metric_rating`
- `page_path`
- `non_interaction`

برای CLS، مقدار در 1000 ضرب می‌شود تا به شکل integer در GA ثبت شود.

## تصمیم درباره فونت

در حال حاضر Peyda از چهار فایل TTF حدود 200KB استفاده می‌کند. `next/font/local` و `display: swap` فعال هستند.

قبل از تغییر preload یا وزن‌ها باید Network و Web Vitals production بررسی شوند؛ حذف preload بدون اندازه‌گیری ممکن است LCP متن یا layout stability را بدتر کند. اگر فونت bottleneck بود، مرحله بعدی تبدیل assetهای مجاز به WOFF2/subset و مقایسه قبل/بعد است.

## معیار پذیرش

- هیچ regression عملکردی در checkout، price یا inventory freshness وجود نداشته باشد.
- Product/Category image LCP درخواست رقابتی high-priority نداشته باشد.
- GA4 بعد از چند روز داده واقعی برای LCP/INP/CLS داشته باشد.
- Search Console Core Web Vitals بعد از جمع‌شدن داده میدانی بررسی شود.
