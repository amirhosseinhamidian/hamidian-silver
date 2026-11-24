# CAM-X04 — مرکز عملیات کمپین

وضعیت `DONE` است. پیاده‌سازی روی `seo-fix` با پایهٔ `b539f86` انجام شد. مدیر پروژه موفقیت تست‌های محلی را گزارش کرد. نتیجهٔ هر بررسی جداگانه ثبت نشده است. کامیت `43d8705ef36bef6e9c4c3f416cd4e51a6dd6bed5` روی `seo-fix` و `origin/seo-fix` تأیید شد. این مرحله مهاجرت تازه‌ای ندارد.

## عملیات کمپین

در **کمپین‌های فروش ← مرکز عملیات** وضعیت انتشار، سفارش، پرداخت، سهمیه و بودجهٔ کمپین دیده می‌شود. صفحه از آخرین وضعیت ثبت‌شده در زمان دریافت گزارش استفاده می‌کند. برای خواندن مرکز به مجوز خواندن تنظیمات و سفارش‌ها نیاز است. بخش هزینهٔ قطعی و پیوند گزارش مالی برای نقش دارای مجوز خواندن مالی نمایش داده می‌شوند.

سفارش‌هایی که تخفیف این کمپین در Snapshot آن‌ها ثبت شده یا انتساب نهایی‌شان این کمپین است، هر کدام یک بار شمرده می‌شوند. شمار خرید قطعی از تعریف GM-03 و GM-04 استفاده می‌کند. در فهرست، رد رسید و شکست قطعی از وضعیت آخرین تلاش پرداخت خوانده می‌شوند. اگر سفارش خرید قطعی و تطبیق باز داشته باشد، در آمار خرید قطعی باقی می‌ماند و در ردیف سفارش، نیاز به تطبیق اولویت دارد. رزروهای گذشته از مهلت، وضعیت رسید و نیاز به تطبیق برای رسیدگی نمایش داده می‌شوند. خطاهای پیش از ساخت سفارش به کمپین منتسب نمی‌شوند و صفحه آزمون زندهٔ درگاه انجام نمی‌دهد.

شمار فروش دستی، رزرو و فروش قطعی کالاهای سهمیه‌دار از CAM-X05 خوانده می‌شود. موجودی قابل فروش انبار پیش‌فرض با ماندهٔ سهمیهٔ همان محصول مقایسه می‌شود. هشدار کسری برای ردیف‌های صفحهٔ سهمیهٔ جاری است. هزینهٔ تخفیف کالایی و ارسالِ خرید قطعی از همان مبنای CM-05 می‌آید. تعهد و ماندهٔ بودجه از موتور فعلی کمپین و درآمد از صفحهٔ گزارش GM-04 و CM-05 در دسترس‌اند. ثبت فروش دستی سفارش، پرداخت یا درآمد تولید نمی‌کند.

دکمهٔ توقف اضطراری برای کمپین فعال یا زمان‌بندی‌شده و نقش دارای مجوز تغییر تنظیمات دیده می‌شود. درخواست همان گذار `PAUSE`، نسخهٔ مورد انتظار و شناسهٔ درخواست را استفاده می‌کند. سابقهٔ وضعیت، مدیر و زمان در نسخهٔ کمپین و جزئیات عملیات در Audit ثبت می‌شود. پیوندهای سفارش، محصول، لندینگ و گزارش از همان پنل در دسترس‌اند. خواندن ردیف سهمیه به‌صورت دسته‌ای و صفحه‌بندی‌شده است. زمان پاسخ روی دادهٔ نمایندهٔ تولید اندازه‌گیری نشده است.

## اجرای محلی

~~~bash
cd "/Users/amirhosseinhamidian/Projects/hamidian-silver" &&
pnpm contracts:generate &&
pnpm contracts:typecheck &&
pnpm api:lint &&
pnpm api:typecheck &&
pnpm api:test --runInBand modules/campaigns modules/orders modules/growth-attribution modules/audit modules/authorization &&
pnpm admin:lint &&
pnpm admin:typecheck &&
pnpm admin:test orders-model.test.ts order-management-view.test.tsx &&
pnpm admin:build
~~~

برای آزمون PostgreSQL، کانتینر آزمایشی روی پورت آزاد ایجاد می‌شود. این بلوک از دیتابیس اجرای لوکال استفاده نمی‌کند.

~~~bash
(
  cd "/Users/amirhosseinhamidian/Projects/hamidian-silver" || exit 1
  cam_x04_db="$(docker run -d --rm \
    -e POSTGRES_USER=hamidian -e POSTGRES_PASSWORD=cam_x04_local \
    -e POSTGRES_DB=hamidian_cam_x04_test -p 127.0.0.1::5432 postgres:18.6-alpine)" || exit 1
  trap 'docker stop "$cam_x04_db" >/dev/null' EXIT

  for attempt in {1..30}; do
    docker exec "$cam_x04_db" pg_isready -q -h 127.0.0.1 -U hamidian -d hamidian_cam_x04_test && break
    sleep 1
  done
  docker exec "$cam_x04_db" pg_isready -h 127.0.0.1 -U hamidian -d hamidian_cam_x04_test || exit 1
  cam_x04_address="$(docker port "$cam_x04_db" 5432/tcp)" || exit 1
  export DATABASE_URL="postgresql://hamidian:cam_x04_local@${cam_x04_address}/hamidian_cam_x04_test"
  pnpm db:generate &&
  pnpm exec prisma migrate deploy &&
  pnpm api:test:e2e --runInBand 'campaign-quota|campaign-lifecycle|campaign-landing|campaign-operations|growth-dashboard|growth-revenue'
)
~~~

برای بازبینی دستی، در محیط لوکال برای یک کمپین فعال با سهمیهٔ ذخیره‌شده، یک فروش دستی و یک سفارش واقعی آزمایشی ثبت کنید. وضعیت سفارش را در مرحلهٔ انتظار رسید، رد یا تأیید با مرکز عملیات مقایسه کنید. از جدول سهمیه، محصول و از جدول سفارش‌ها سفارش مرتبط را باز کنید. هزینهٔ قطعی را با گزارش عملکرد کمپین مقایسه کنید. با حساب فقط‌خواندنی، دکمهٔ توقف و با حساب بدون مجوز مالی، بخش هزینه نباید دیده شود. با نقش مجاز توقف را اجرا و وضعیت و ثبت آن را در تاریخچه و Audit بررسی کنید.
