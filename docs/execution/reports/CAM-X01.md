# CAM-X01 — قیمت و تخفیف کمپین

وضعیت `IN_REVIEW` است. پیاده‌سازی روی `seo-fix` از پایهٔ `800549c` انجام شد. مدیر پروژه موفقیت تست‌های محلی را گزارش کرد. نتیجهٔ تفکیکی آزمون‌ها جداگانه ثبت نشده است. SHA کامیت در انتظار ثبت است.

## مبنای قیمت

کارت و لندینگ از قیمت پیش‌فرض جاری محصول استفاده می‌کنند. در فهرست‌هایی که برای فیلتر یا مرتب‌سازی قیمت واریانت منطبق را می‌خوانند، API دو فیلد اختیاری قیمت پیش‌فرض را جدا برمی‌گرداند. صفحهٔ محصول و پیش‌نمایش Admin قیمت جاری هر واریانت را از همان فیلد قیمت Checkout می‌خوانند. واریانت قدیمی با قیمت خالی، قیمت همان محصول را به ارث می‌برد. دادهٔ تاریخی و قیمت مقایسه‌ای برای تخفیف کمپین دخالتی ندارند. قیمت‌های صریح ناسازگار در محصولات تک‌واریانتی نیاز به بررسی داده دارند. این تسک قیمت‌های کاتالوگ را بازنویسی نمی‌کند.

پاسخ کاتالوگ قیمت هر واحد را با موتور CM-02، اولویت، بودجه و تعداد استفادهٔ جاری محاسبه می‌کند. مبلغ ثابتِ فعلی به سفارش تعلق دارد و همراه با توضیح نمایش داده می‌شود. کوپن، حداقل خرید، بسته، ارسال رایگان و مخاطب محدود نیز پیام شرایط دارند و هیچ کد کوپنی از مسیر عمومی برنمی‌گردد. قیمت یک واحد در فهرست قیمت نهایی کل سبد را تعیین نمی‌کند. Checkout قیمت، تعداد اقلام، بودجه، شرایط ارسال و قانون را بازاعتبارسنجی می‌کند. قیمت واحد پیش از تخفیف، مبلغ اعمال‌شده، مبلغ نهایی سفارش و نسخهٔ قانون در Snapshot موجود CM-02 ثبت می‌شوند. افزودن محصول به سبد با قیمت عادی انجام می‌شود تا تخفیف برای بار دوم کم نشود.

در پنل به مسیر **کمپین ← قانون و کوپن ← پیش‌نمایش قیمت محصول و واریانت‌ها** بروید. پیش‌نمایش قانون ذخیره‌شدهٔ همان کمپین، قیمت پیش‌فرض، واریانت‌ها و شرط‌های باقی‌مانده را با مجوز خواندن تنظیمات نشان می‌دهد. مبلغ سفارش شامل قوانین دیگر، ارسال و تعداد اقلام از مسیر شبیه‌سازی سبد بررسی می‌شود.

در درخواست جدید، تغییر قیمت یا وضعیت کمپین در خروجی قیمت دیده می‌شود. در صفحهٔ باز، زمان پایان پیشنهاد از همان تاریخ ثبت‌شده کنترل می‌شود. دادهٔ ساختاریافتهٔ Offer فقط قیمت مستقیم و عمومی همان واریانت قابل خرید را بازتاب می‌دهد. URL، Canonical، Robots و Sitemap از قواعد فعلی پیروی می‌کنند. بار خواندن مشوق‌ها به یک مجموعهٔ مشترک در هر صفحهٔ فهرست محدود است. این اندازه‌گیری روی دادهٔ نمایندهٔ VPS انجام نشده است.

## اجرای محلی

```bash
pnpm contracts:generate && pnpm contracts:typecheck &&
pnpm api:lint && pnpm api:typecheck &&
pnpm api:test --runInBand modules/promotions modules/catalog modules/orders modules/site-settings &&
pnpm frontend:lint && pnpm frontend:typecheck &&
pnpm storefront:test catalog-product-card.test.tsx product-purchase-panel.test.tsx structured-data.test.ts &&
pnpm frontend:build
```

آزمون‌های PostgreSQL، قیمت تک‌واریانت، تفاوت قیمت پیش‌فرض با قیمت واریانت دوم، تغییر قیمت در کمپین فعال، رد قیمت پیشنهادی قدیمی و حفظ مبلغ و نسخهٔ سفارش را پوشش می‌دهند. بلوک زیر یک پایگاه دادهٔ آزمایشی مجزا روی پورت آزاد محلی ایجاد می‌کند.

```bash
(
  cd "/Users/amirhosseinhamidian/Projects/hamidian-silver" || exit 1
  cam_x01_db="$(docker run -d --rm \
    -e POSTGRES_USER=hamidian -e POSTGRES_PASSWORD=cam_x01_local \
    -e POSTGRES_DB=hamidian_cam_x01_test -p 127.0.0.1::5432 postgres:18.6-alpine)" || exit 1
  trap 'docker stop "$cam_x01_db" >/dev/null' EXIT

  for attempt in {1..30}; do
    docker exec "$cam_x01_db" pg_isready -q -h 127.0.0.1 -U hamidian -d hamidian_cam_x01_test && break
    sleep 1
  done
  docker exec "$cam_x01_db" pg_isready -h 127.0.0.1 -U hamidian -d hamidian_cam_x01_test || exit 1
  cam_x01_address="$(docker port "$cam_x01_db" 5432/tcp)" || exit 1
  export DATABASE_URL="postgresql://hamidian:cam_x01_local@${cam_x01_address}/hamidian_cam_x01_test"

  pnpm db:generate &&
  pnpm exec prisma migrate deploy &&
  pnpm api:test:e2e --runInBand 'promotion-checkout|campaign-operations|campaign-landing'
)
```

برای بررسی صفحات عمومی و مسیر خرید اجرا کنید.

```bash
pnpm storefront:test:e2e campaign-landing.spec.ts catalog-seo.spec.ts purchase-flow.spec.ts
```

در محیط محلی یک محصول چندواریانتی با پیش‌فرض متفاوت و یک کمپین درصدیِ بدون شرط بسازید. قیمت خط‌خورده و نهایی کارت را با ردیف پیش‌فرض پنل و قیمت هر گزینه را با ردیف همان واریانت مقایسه کنید. قیمت یک واریانت را در طول کمپین تغییر دهید و دوباره قیمت فهرست، محصول و Checkout را بررسی کنید. با قانون حداقل خرید یا کوپن مستقل، فقط شرایط را در نمایش عمومی ببینید.
