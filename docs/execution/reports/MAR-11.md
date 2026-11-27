# MAR-11 | مرکز عملیات کمپین

وضعیت **IN_REVIEW** روی شاخهٔ `seo-fix` است. مدیر پروژه پاس شدن تست‌های لوکال [MAR-10](MAR-10.md) را تأیید کرد.

- مرکز عملیات جشنواره و پیشنهاد فروش، وضعیت و زمان‌بندی، وجود قانون تخفیف، ماندهٔ سهمیه و ماندهٔ بودجه را در ابتدای صفحه نشان می‌دهد. زمان باقی‌مانده از زمان بررسی سرور محاسبه می‌شود.
- هشدارهای رسید، پرداخت و رزرو مستقیماً جدول سفارش را با فیلتر مربوط باز می‌کنند. فیلتر جدید رزرو از همان شرط شمارش و همان زمان مرجع استفاده می‌کند. مرتب‌سازی، صفحه‌بندی، بازگشت به فهرست کمپین و پیوند جزئیات سفارش حفظ می‌شوند.
- جدول سهمیه قیمت پیش‌فرض، وضعیت، تصویر در صورت وجود، قیمت واریانت‌های مرتبط، موجودی قابل فروش، فروش قطعی سایت، فروش دستی و رزرو را نشان می‌دهد. کسری، اتمام سهمیه و قیمت پیش‌فرض نامعتبر در ردیف مربوط مشخص‌اند. شمارش سلامت جشنواره سراسری است و هشدار سهمیه برای سایر کمپین‌ها با برچسب صفحهٔ فعلی نمایش داده می‌شود.
- با `finance.read`، تخفیف کالایی و ارسال خرید تأییدشده، کل تخفیف تعهدشده، پاداش معرف منظورشده و ماندهٔ بودجه جدا دیده می‌شوند. نوار بودجه، مجموع تعهدهای فعلی را نسبت به سقف نشان می‌دهد. تاریخچه و توقف اضطراری از دسترسی‌های موجود استفاده می‌کنند.

صحت قیمت در این صفحه با قیمت پیش‌فرض ثبت‌شدهٔ محصولات فعال سهمیه‌دار بررسی می‌شود. رخدادهای خطای Checkout قبل از ثبت سفارش، دادهٔ قابل انتساب و جداگانه‌ای در این صفحه ندارند. تغییرات این مرحله به پنل مدیریت و API عملیاتی محدودند و Migration تازه‌ای لازم نیست.

## تست‌های لوکال

```zsh
cd "/Users/amirhosseinhamidian/Projects/hamidian-silver" &&
pnpm api:lint &&
pnpm api:typecheck &&
pnpm api:test --runInBand modules/campaigns modules/authorization &&
pnpm admin:lint &&
pnpm admin:typecheck &&
pnpm admin:test src/components/campaigns/campaign-operations-center.test.tsx
```

```zsh
(
  cd "/Users/amirhosseinhamidian/Projects/hamidian-silver" || exit 1

  mar11_db="$(docker run -d --rm \
    -e POSTGRES_USER=hamidian \
    -e POSTGRES_PASSWORD=mar11_local \
    -e POSTGRES_DB=hamidian_mar11_test \
    -p 127.0.0.1::5432 postgres:18.6-alpine)" || exit 1
  trap 'docker stop "$mar11_db" >/dev/null 2>&1' EXIT

  for attempt in {1..30}; do
    docker exec "$mar11_db" pg_isready -q -h 127.0.0.1 -U hamidian -d hamidian_mar11_test && break
    sleep 1
  done
  docker exec "$mar11_db" pg_isready -h 127.0.0.1 -U hamidian -d hamidian_mar11_test || exit 1

  mar11_address="$(docker port "$mar11_db" 5432/tcp)" || exit 1
  case "$mar11_address" in
    127.0.0.1:[0-9]*) ;;
    *) exit 1 ;;
  esac
  export DATABASE_URL="postgresql://hamidian:mar11_local@${mar11_address}/hamidian_mar11_test?schema=public"

  pnpm db:generate &&
  pnpm exec prisma migrate deploy &&
  pnpm api:test:e2e --runInBand 'campaign-quota|campaign-lifecycle|campaign-landing|campaign-operations'
)
```

۱. مرکز عملیات یک جشنواره و یک پیشنهاد فروش را باز کنید. تاریخ، وضعیت قانون فروش و پیوندهای سفارش و سهمیه را بررسی کنید. تغییر صفحه و بازگشت مرورگر باید فیلتر و مرتب‌سازی را حفظ کنند.

۲. با دادهٔ لوکال دارای رسید منتظر بررسی یا رزرو گذشته از مهلت، پیوند هشدار را باز کنید. فیلتر و نتیجه باید با شمارش هشدار سازگار باشند. برای یک محصول کم‌موجودی و چندواریانتی نیز جدول سهمیه را در عرض موبایل با صفحه‌کلید بررسی کنید.

۳. با حساب خواندنی بدون مجوز مالی، پنهان بودن بودجه، هشدارهای مالی و توقف اضطراری را بررسی کنید. با حساب مجاز، عدد تخفیف قطعی کالا و ارسال، مبلغ تعهدشده و نوار بودجه را با دادهٔ سفارش‌ها تطبیق بدهید.

مدیر پروژه پاس شدن تست‌های لوکال را تأیید کرد. نتیجهٔ بازبینی مرورگر و SHA جداگانه ثبت نشده‌اند.
