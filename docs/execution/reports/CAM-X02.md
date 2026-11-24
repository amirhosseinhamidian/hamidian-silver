# CAM-X02 — عناصر عمومی کمپین و تگ تاریخی سفارش

وضعیت `IN_REVIEW` است. تغییرات روی `seo-fix` با پایهٔ `9bad4e7` آماده‌اند. مدیر پروژه موفقیت تست‌های محلی را گزارش کرد. نتیجهٔ تفکیکی بررسی‌ها جداگانه ثبت نشده است. SHA کامیت در انتظار ثبت است.

## فروشگاه و سفارش

کارت فعلی، پیشنهادهای جست‌وجو، مجموعه‌های صفحهٔ نخست و صفحهٔ محصول نام، قیمت، شرایط و سهمیه را با قرارداد مشترک کاتالوگ نمایش می‌دهند. موتور قیمت و سهمیهٔ مراحل قبل مبنای مقدار نمایش است. پس از پایان بازه، نمایش حذف می‌شود. در تب باز و قابل مشاهده نیز وضعیت کمپینِ در حال نمایش با یک درخواست مشترک هر ۳۰ ثانیه بررسی می‌شود. توقف کمپین تگ، قیمت کمپین، سهمیه، بنر و ورودی منوی همان کمپین را از نمایش حذف می‌کند. در صورت خطای موقت شبکه، نتیجهٔ آخرین بررسی و زمان پایان ثبت‌شده مبنا هستند. میزان سهمیه در درخواست کاتالوگ به‌روز می‌شود. نشانی محصول، Canonical، Robots، Redirect و Sitemap از قواعد موجود پیروی می‌کنند. قیمت Offer ساختاریافته از همان پاسخ کاتالوگ خوانده می‌شود.

ثبت سفارش، شناسه و نام کمپین را در سطح کالاهای مشمول قانون ذخیره می‌کند. در تخفیف بسته‌ای، فقط محصولات بسته تگ می‌گیرند. تاریخچهٔ خرید و ردیف کالا در سفارش پنل از Snapshot استفاده می‌کنند. تغییر نام، توقف یا پایان کمپین روی تگ تاریخی اثری ندارد. سفارش‌های قبلی با مقادیر خالی معتبرند.

## تنظیمات پنل

در **کمپین ← صفحه و مجموعه ← جایگاه‌های بنر**، برای نوار سراسری و ورودی منو می‌توان اولویت و بازهٔ جدا تعیین کرد. گزینهٔ نمایش بنر در پیش‌نویس کمپین، جایگاه‌ها را فعال می‌کند. در نوار، حداقل ارتفاع موبایل و دسکتاپ از ۴۸ تا ۳۲۰ پیکسل، رنگ متن و تصویر جداگانه قابل تنظیم‌اند. لینک از دکمهٔ اصلی کمپین خوانده می‌شود و در نبود آن به صفحهٔ کمپین می‌رود. جلوهٔ منو از رنگ ثابت، گرادیان ثابت یا گرادیان با حرکت کوتاه انتخاب می‌شود. حرکت منو از تنظیم کاهش حرکت دستگاه پیروی می‌کند.

جایگاه‌های بنر تصویر ثابت یا GIF می‌پذیرند. سقف GIF چهار مگابایت است و ساختار، ابعاد و تعداد فریم در سرور کنترل می‌شوند. هر تصویر همراه متن جایگزین ثبت می‌شود. GIF به تصویر ثابت جایگزین نیاز دارد. در تنظیم کاهش حرکت یا با زدن دکمهٔ توقف، تصویر ثابت نشان داده می‌شود. اولویت، بازه، دسترسی و ثبت نسخه از همان مسیر انتشار کمپین می‌آیند. زمان پاسخ در دادهٔ نمایندهٔ تولید اندازه‌گیری نشده است.

## اجرای محلی

~~~bash
cd "/Users/amirhosseinhamidian/Projects/hamidian-silver" &&
pnpm contracts:generate &&
pnpm contracts:typecheck &&
pnpm api:lint &&
pnpm api:typecheck &&
pnpm api:test --runInBand modules/campaigns modules/catalog modules/orders modules/promotions modules/site-settings &&
pnpm frontend:lint &&
pnpm frontend:typecheck &&
pnpm admin:test orders-model.test.ts &&
pnpm storefront:test campaign-visibility.test.tsx campaign-banner.test.tsx storefront-header.test.tsx storefront-search.test.tsx catalog-product-card.test.tsx product-purchase-panel.test.tsx customer-order-detail.test.tsx structured-data.test.ts &&
pnpm frontend:build
~~~

PostgreSQL آزمایشی روی یک پورت آزاد اجرا می‌شود. در پایان بلوک همان کانتینر جمع می‌شود.

~~~bash
(
  cd "/Users/amirhosseinhamidian/Projects/hamidian-silver" || exit 1
  cam_x02_db="$(docker run -d --rm \
    -e POSTGRES_USER=hamidian -e POSTGRES_PASSWORD=cam_x02_local \
    -e POSTGRES_DB=hamidian_cam_x02_test -p 127.0.0.1::5432 postgres:18.6-alpine)" || exit 1
  trap 'docker stop "$cam_x02_db" >/dev/null' EXIT

  for attempt in {1..30}; do
    docker exec "$cam_x02_db" pg_isready -q -h 127.0.0.1 -U hamidian -d hamidian_cam_x02_test && break
    sleep 1
  done
  docker exec "$cam_x02_db" pg_isready -h 127.0.0.1 -U hamidian -d hamidian_cam_x02_test || exit 1
  cam_x02_address="$(docker port "$cam_x02_db" 5432/tcp)" || exit 1
  export DATABASE_URL="postgresql://hamidian:cam_x02_local@${cam_x02_address}/hamidian_cam_x02_test"
  pnpm db:generate &&
  pnpm exec prisma migrate deploy &&
  pnpm api:test:e2e --runInBand 'campaign-landing|campaign-lifecycle|promotion-checkout|campaign-quota'
)
~~~

~~~bash
cd "/Users/amirhosseinhamidian/Projects/hamidian-silver" &&
pnpm storefront:test:e2e campaign-landing.spec.ts catalog-seo.spec.ts purchase-flow.spec.ts
~~~

برای بازبینی دستی، یک کمپین محلی با محصول موجود، تخفیف مستقیم و سهمیه تعریف کنید. یک تصویر ثابت موبایل و یک GIF دسکتاپ همراه تصویر جایگزین در جایگاه شمارش معکوس قرار دهید. اولویت، زمان شروع و پایان، ارتفاع، رنگ متن و لینک را در اندازه‌های موبایل و دسکتاپ بررسی کنید. کاهش حرکت را از تنظیم مرورگر فعال کنید و سپس در حالت عادی دکمهٔ توقف تصویر را امتحان کنید. نام کمپین، قیمت و سهمیه را در کارت، جست‌وجو و صفحهٔ کالا مقایسه کنید. یک سفارش کمپینی ثبت کنید، کمپین را متوقف کنید و حذف عناصر عمومی را با باز ماندن تب بررسی کنید. تگ سفارش در حساب مشتری و پنل باید با نام ثبت‌شدهٔ زمان خرید دیده شود.
