# ممیزی امنیتی پنل Admin

- مرحله: `ADMIN-039C`
- آخرین بازبینی: `2026-09-11`
- دامنه: session و token، BFFهای مدیریتی، upload رسانه، Audit Log و عملیات مالی حساس
- نتیجه: کنترل‌های درون برنامه‌ای آماده‌اند؛ کنترل‌های لبه شبکه و secrets باید در مراحل `VPS-003`
  تا `VPS-005` تکمیل شوند.

این سند شواهد قابل‌تکرار ممیزی را ثبت می‌کند. وجود یک کنترل در رابط کاربری جای کنترل API را
نمی‌گیرد و وجود permission نیز جای تأیید آگاهانه اپراتور را نمی‌گیرد.

## خلاصه نتیجه

| حوزه                           | نتیجه | شاهد اصلی                                                                 |
| ------------------------------ | ----- | ------------------------------------------------------------------------- |
| افشا نشدن bearer token         | قبول  | cookie امن و پاسخ مرورگر بدون token                                       |
| جلوگیری از CSRF روی BFF        | قبول  | رد mutation با Origin غیرهمسان در `apps/admin/src/proxy.ts`               |
| کنترل upload                   | قبول  | سقف و whitelist در Admin، تشخیص امضای فایل و نام تصادفی در API            |
| Audit Log                      | قبول  | ثبت موفق/ناموفق، actor و request ID، بدون body و با redaction تکمیلی      |
| permission مالی                | قبول  | تمام mutationهای مالی نیازمند `finance.write`                             |
| تأیید عملیات مالی حساس         | قبول  | dialog مستقل، مرجع/یادداشت و تأیید نهایی پیش از ارسال mutation            |
| اسکن بدافزار و WAF             | باز   | برای تصاویر محدود فعلی blocker نیست؛ در صورت پذیرش فایل عمومی بازبینی شود |
| TLS، rate limit و secret store | باز   | جزو gate استقرار VPS است                                                  |

## ۱. session، token و مرز مرورگر

توکن backend فقط در cookie با نام `__Host-hamidian-admin-session` نگهداری می‌شود. گزینه‌های
`HttpOnly`، `Secure`، `SameSite=Lax` و `Path=/` فعال‌اند و Domain تنظیم نمی‌شود. پاسخ login که به
مرورگر می‌رسد فقط `expiresAt` و اطلاعات کاربر را دارد و `accessToken` یا `tokenType` را برنمی‌گرداند.

قواعد الزامی:

1. bearer token را در Client Component، `localStorage`، query string یا پاسخ JSON قرار ندهید.
2. تماس احراز‌شده با API فقط در کد server-only و از طریق BFF انجام شود.
3. مقدار `HAMIDIAN_API_ORIGIN` نباید credential، path، query یا fragment داشته باشد.
4. token، OTP، cookie و Authorization نباید در خطا، analytics یا Audit Log ثبت شوند.
5. در production هیچ secret واقعی در فایل tracked یا image Docker قرار نگیرد.

### کنترل CSRF

تمام درخواست‌های ناامن `/api/*` پنل، شامل `POST`، `PUT`، `PATCH` و `DELETE`، پیش از رسیدن به BFF
باید یکی از این شواهد مرورگر را داشته باشند:

- `Origin` دقیقاً برابر origin پنل باشد؛ یا
- در نبود Origin، مقدار `Sec-Fetch-Site` برابر `same-origin` باشد.

درخواست cross-origin با `403` متوقف می‌شود؛ حتی اگر مرورگر به هر دلیل cookie نشست را همراه آن
فرستاده باشد. `GET`، `HEAD` و `OPTIONS` mutation محسوب نمی‌شوند. اسکریپت عملیاتی یا تستی که مستقیم
BFF را فراخوانی می‌کند نیز باید Origin معتبر پنل را ارسال کند.

## ۲. کنترل upload رسانه

فقط JPEG، PNG، WebP و AVIF مجاز هستند. SVG، HTML، فایل خالی، چند فایل در یک درخواست و فیلدهای
multipart ناشناخته رد می‌شوند.

کنترل‌ها در دو لایه اجرا می‌شوند:

| لایه        | کنترل                                                                                  |
| ----------- | -------------------------------------------------------------------------------------- |
| Admin BFF   | multipart اجباری، سقف ۱۰ MB به‌علاوه overhead محدود، دقیقاً یک فایل و whitelist فیلدها |
| API/Multer  | سقف ۱۰ MB و حداکثر یک فایل                                                             |
| Storage API | تطبیق MIME اعلامی با magic bytes، پسوند مشتق از محتوا و نام UUID                       |
| Filesystem  | mode فایل `0640`، مسیر تولیدشده داخل media root و جلوگیری از traversal هنگام حذف       |
| HTTP        | Helmet، cache immutable و Cross-Origin-Resource-Policy صریح                            |
| Permission  | `catalog.write`، `cms.write` یا `settings.write` متناسب با endpoint                    |

نام فایل ورودی فقط metadata است و هیچ‌گاه برای ساخت مسیر ذخیره‌سازی استفاده نمی‌شود.
`MEDIA_STORAGE_ROOT` در production باید مسیر دائمی `/var/lib/hamidian-silver/media` باشد و user
فرایند API فقط روی همان مسیر دسترسی نوشتن داشته باشد.

کنترل مکمل استقرار: در Nginx نیز `client_max_body_size` متناسب با سقف برنامه تنظیم شود تا بدنه
بزرگ پیش از رسیدن به Node رد شود. اگر در آینده PDF، ویدئو یا upload عمومی اضافه شد، threat model،
content disarm/virus scanning و سهمیه کاربر باید جداگانه طراحی شوند.

## ۳. Audit Log و داده حساس

Interceptor سراسری برای هر mutation احراز‌شده، نتیجه موفق یا ناموفق را با actor، نقش، زمان،
status code، request ID، IP، user agent، action فنی و عنوان انسانی ثبت می‌کند.

مواردی که عمداً ثبت نمی‌شوند:

- request body و response body خام؛
- Authorization و Cookie؛
- query string؛
- password، OTP، token، session، API key، اطلاعات کارت و credential درگاه؛
- فیلدهای حساس داخل تغییرات ساختاریافته.

redaction علاوه بر نام فیلد، الگوهای `Bearer`، JWT و انتساب‌هایی مانند `token=...` را در متن‌های
مجاز و headerهای audit حذف می‌کند. metadata ذخیره‌شده فقط فهرست محدود role codeهاست. جدول
`audit_logs` append-only است و تغییر یا حذف رکورد توسط trigger پایگاه داده رد می‌شود.

بعد از یک عملیات مالی آزمایشی، در صفحه Audit این موارد را تطبیق دهید:

1. actor همان Manager واردشده باشد؛
2. outcome و status code با نتیجه واقعی یکسان باشد؛
3. action فنی endpoint را مشخص کند؛
4. request ID برای همبستگی با log عملیاتی موجود باشد؛
5. هیچ token، cookie، OTP، Authority یا payload خام نمایش داده نشود.

## ۴. عملیات مالی حساس

mutationهای refund، reconciliation، بازیابی شروع پرداخت، پرداخت/لغو تسویه تأمین‌کننده و ثبت
پرداخت بدهی فقط با `finance.write` مجازند. نقش Admin پیش‌فرض این permission را ندارد و Manager
دارد.

در پنل، عملیات حساس داخل dialog مستقل نمایش داده می‌شود و ارسال فقط پس از تأیید نهایی انجام
می‌شود. کنترل‌های تکمیلی فعلی عبارت‌اند از:

- refund قطعی بدون مرجع بازپرداخت درگاه پذیرفته نمی‌شود؛
- reconciliation بدون مرجع خارجی و یادداشت حداقل سه‌کاراکتری پذیرفته نمی‌شود؛
- بازیابی redirect بدون Authority و URL معتبر انجام نمی‌شود؛
- تسویه دارای مبلغ نقدی بدون مرجع پرداخت ثبت نمی‌شود؛
- پاسخ `409` به‌عنوان تغییر هم‌زمان تلقی می‌شود و اپراتور باید داده را دوباره بخواند؛
- state transition و قیدهای مبلغ در service و transaction پایگاه داده دوباره کنترل می‌شوند؛
- تلاش موفق و ناموفق هر دو وارد Audit Log می‌شوند.

تأیید dialog مجوز انجام عملیات نیست؛ API مستقل از UI permission و وضعیت رکورد را بررسی می‌کند.
برای مبلغ‌های مهم، رویه بازبینی نفر دوم در راهنمای عملیات همچنان الزامی است.

## ۵. آزمون و شواهد بازتولیدپذیر

از ریشه repository اجرا شود:

```bash
pnpm admin:test
pnpm api:test
pnpm verify
```

پوشش‌های امنیتی مرتبط:

- `apps/admin/src/proxy.test.ts`: پذیرش same-origin و رد cross-origin؛
- `apps/admin/src/lib/security/media-upload.test.ts`: حجم، نوع، تعداد و فیلدهای upload؛
- `apps/admin/src/lib/auth/session-cookie.test.ts`: ویژگی cookie و حذف token از پاسخ؛
- `apps/admin/src/lib/auth/critical-operations-bff.test.ts`: نشست و خطاهای BFF مالی؛
- `apps/api/src/modules/catalog/local-media-storage.service.spec.ts`: magic bytes و traversal؛
- `apps/api/src/modules/audit/audit-event.spec.ts`: حذف فیلد و متن حساس؛
- `apps/api/src/modules/audit/audit.interceptor.spec.ts`: ثبت نتیجه و عدم ثبت body؛
- `apps/api/src/modules/authorization/permission-coverage.spec.ts`: پوشش permission endpointها.

## ۶. gate پیش از production

- [ ] secret scan روی repository و image نهایی بدون یافته انجام شده است.
- [ ] secretهای staging با production مشترک نیستند و امکان rotation مستند است.
- [ ] Nginx فقط دامنه‌های مورد انتظار را می‌پذیرد و سقف upload دارد.
- [ ] PostgreSQL و Redis از اینترنت قابل دسترسی نیستند.
- [ ] TLS، HSTS و firewall فعال‌اند.
- [ ] `MEDIA_STORAGE_ROOT` بیرون release directory و با owner محدود است.
- [ ] یک upload مجاز و SVG/فایل بزرگ/فایل spoofشده عملاً آزمایش شده‌اند.
- [ ] User و Admin بدون `finance.write` برای عملیات مالی `403` می‌گیرند.
- [ ] یک Manager عملیات مالی کم‌مبلغ را با dialog، مرجع و Audit Log کامل کرده است.
- [ ] تلاش cross-origin روی یک BFF mutation پاسخ `403` گرفته است.
- [ ] log و Audit Log برای token، cookie، OTP و credential جست‌وجو و پاک بودنشان تأیید شده است.
- [ ] backup و restore واقعی پیش از نگهداری داده production آزمایش شده‌اند.

## ریسک‌های باقیمانده و مالک مرحله

| ریسک                              | اقدام بعدی                                           | مرحله         |
| --------------------------------- | ---------------------------------------------------- | ------------- |
| بدنه بزرگ پیش از اپلیکیشن         | محدودیت Nginx و timeoutهای لبه                       | `VPS-003`     |
| مدیریت و rotation secrets         | env خارج Git و secret store/فایل با permission محدود | `VPS-005`     |
| پایش تلاش‌های ناموفق و disk       | logging، alert و uptime monitoring                   | `VPS-008`     |
| کنترل dependency و secret در CI   | lint/test/build/migration/security checks            | `VPS-009`     |
| اثبات جریان واقعی در staging      | E2E و تست upload/permission/finance                  | `VPS-010`     |
| بازبینی نفر دوم برای مبلغ‌های مهم | اجرای رویه سازمانی و ثبت شاهد incident               | عملیاتی مستمر |
