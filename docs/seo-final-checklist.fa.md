# چک‌لیست نهایی SEO گالری حمیدیان

این سند وضعیت branch تجمیعی `seo-phase-1` را پیش از Merge نهایی ثبت می‌کند.

## Technical SEO

| مورد                                                 | وضعیت  | توضیح                                                         |
| ---------------------------------------------------- | ------ | ------------------------------------------------------------- |
| عنوان و برند نهایی «گالری حمیدیان»                   | ✅     | fallbackهای Storefront/Admin/API/Prisma یکسان شده‌اند         |
| canonical عمومی                                      | ✅     | self-canonical + validation سه‌لایه                           |
| canonical مسیرهای Product/Category/Brand             | ✅     | فقط داخل namespace مربوطه                                     |
| historical redirects                                 | ✅     | 308، single-hop و validation سخت‌شده                          |
| robots.txt                                           | ✅     | API/payment مسدود؛ utility HTML crawlable تا noindex دیده شود |
| noindex صفحات account/cart/checkout/wishlist/payment | ✅     | metadata خصوصی موجود است                                      |
| filter/search/sort variants                          | ✅     | noindex,follow + canonical تمیز                               |
| pagination تمیز                                      | ✅     | URL مستقل و لینک crawlable                                    |
| pagination خارج محدوده                               | ✅     | 404                                                           |
| Sitemap داینامیک محصولات                             | ✅     | همه محصولات public؛ noindex حذف می‌شود                        |
| Sitemap Category/Brand/Content                       | ✅     | collectionهای خالی حذف می‌شوند                                |
| Sitemap lastModified                                 | ✅     | based on real updatedAt و product aggregation                 |
| /categories hub                                      | ✅     | ساختار parent/child و breadcrumb                              |
| Breadcrumb JSON-LD                                   | ✅     | Product و collectionها                                        |
| Product/ProductGroup schema                          | ✅     | variants، SKU، price، availability، image                     |
| OnlineStore schema                                   | ✅     | logo، sameAs، contactPoint                                    |
| Shipping structured data                             | ✅     | فقط policy قابل بیان با داده واقعی                            |
| Return policy schema                                 | ✅     | لینک به بخش واقعی FAQ                                         |
| Review/AggregateRating ساختگی                        | ✅     | اضافه نشده است                                                |
| hreflang                                             | ✅ N/A | سایت فعلاً فارسی تک‌زبانه است                                 |

## Content / Internal Linking

| مورد                                        | وضعیت | توضیح                                |
| ------------------------------------------- | ----- | ------------------------------------ |
| Keyword Map                                 | ✅    | `docs/seo-content-keyword-map.fa.md` |
| Product meta description fallback           | ✅    | از داده واقعی محصول ساخته می‌شود     |
| short description به عنوان meta description | ✅    | استفاده نمی‌شود                      |
| Category → Brand links                      | ✅    | فقط برندهای واقعی همان محصولات       |
| Brand → Category links                      | ✅    | فقط دسته‌های واقعی همان محصولات      |
| Product → Category/Brand links              | ✅    | موجود                                |
| duplicate SEO title audit                   | ✅    | warning                              |
| duplicate description audit                 | ✅    | موجود                                |
| missing/duplicate alt audit                 | ✅    | موجود                                |
| filename تصویر جدید                         | ✅    | نام محصول + alt + UUID               |
| trademark affiliation claims                | ✅    | در راهنمای محتوا منع شده است         |

## Performance / UX

| مورد                               | وضعیت | توضیح                                           |
| ---------------------------------- | ----- | ----------------------------------------------- |
| AVIF/WebP optimization             | ✅    | Next Image                                      |
| responsive hero images             | ✅    | mobile/desktop source                           |
| single high-priority product image | ✅    | duplicate eager path حذف شده                    |
| fallback first-card LCP preload    | ✅    | فقط بدون Hero                                   |
| taxonomy/settings cache            | ✅    | 60s                                             |
| price/stock freshness              | ✅    | cross-user cache نشده                           |
| optimized image cache              | ✅    | 30 days برای URLهای immutable                   |
| Web Vitals RUM                     | ✅    | GA4 web_vital: LCP/INP/CLS/TTFB                 |
| Peyda WOFF2/subset                 | 🟡    | فقط پس از اندازه‌گیری production تصمیم‌گیری شود |
| Live Core Web Vitals               | 🟡    | پس از Deploy/traffic قابل تأیید است             |

## Security / Production Readiness

| مورد                                | وضعیت   | توضیح                                           |
| ----------------------------------- | ------- | ----------------------------------------------- |
| HTTPS redirect                      | ✅ code | Nginx config                                    |
| www → apex 308                      | ✅ code | Nginx config                                    |
| HSTS                                | ✅ code | فعلاً max-age=300                               |
| X-Content-Type-Options              | ✅      | Storefront deploy + Nginx defense-in-depth      |
| Referrer-Policy                     | ✅      | strict-origin-when-cross-origin                 |
| frame protection                    | ✅      | X-Frame-Options + CSP frame-ancestors           |
| Permissions-Policy                  | ✅      | camera/microphone/geolocation disabled          |
| Full CSP script/style allowlist     | 🟡      | بعد از گزارش/nonce strategy؛ نباید GA4 را بشکند |
| Production env GA4/token validation | ✅      | validator پوشش دارد                             |

## بعد از Deploy — مواردی که هنوز نمی‌توان ✅ کرد

- 🟡 اجرای `SEO_AUDIT_ORIGIN=https://hamidian.shop pnpm seo:audit`
- 🟡 اجرای production content audit روی دیتای واقعی
- 🟡 بررسی Rich Results برای Product/ProductGroup و Breadcrumb
- 🟡 Search Console Domain verification و submit کردن `/sitemap.xml`
- 🟡 URL Inspection برای Home، Products، Categories، Product، Category و Brand
- 🟡 تأیید Google-selected canonical
- 🟡 بررسی GA4 `web_vital` بدون query/PII
- 🟡 PageSpeed/CrUX/Search Console CWV پس از جمع‌شدن داده
- 🟡 بررسی favicon واقعی در Search appearance
- 🟡 افزایش تدریجی HSTS فقط بعد از تأیید همه subdomainها
- 🟡 sync کردن Nginx TLS snippet جدید روی host برای defense-in-depth (Storefront headers مستقل از این sync deploy می‌شوند)

## دستورهای قبل از Merge

```bash
pnpm contracts:generate
pnpm verify:contracts
pnpm verify
python3 -m unittest discover -s deploy -p 'test_*.py'
pnpm frontend:format:check
```

بعد از سبز شدن همه موارد بالا، PR تجمیعی یک‌بار به `main` Merge و فقط یک Production Deploy انجام شود.
