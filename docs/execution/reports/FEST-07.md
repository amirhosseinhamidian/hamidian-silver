# FEST-07 | طراح لندینگ جشنواره

وضعیت `IN_REVIEW` روی `seo-fix`. پیش‌نیازهای `FEST-05` و `FEST-06` با گزارش تست محلی ثبت شده‌اند.

طراح، افزودن، حذف، غیرفعال‌سازی و جابه‌جایی سکشن‌ها با Drag & Drop یا دکمه‌های صفحه‌کلید را پوشش می‌دهد. بخش معرفی از متن لندینگ استفاده می‌کند و می‌تواند متن اختصاصی داشته باشد. بخش‌های محتوایی توضیح، پس‌زمینهٔ دوم تم و رسانهٔ جداگانهٔ موبایل و دسکتاپ می‌پذیرند. GIF با جایگزین ثابت ذخیره می‌شود. سقف نمایش دسته‌ها و بخش‌های منتخب، تخفیف، سهمیه و پیشنهاد از ۱ تا ۲۴ قابل تنظیم است. گزینه‌های زمان‌بندی داخل بازهٔ جشنواره بررسی می‌شوند. بخش همهٔ محصولات در تمام بازه فعال است.

بخش‌های خودکار از صفحه‌های متوالی مجموعهٔ واجد شرایط می‌خوانند و پس از پر شدن بخش‌ها متوقف می‌شوند. تخفیف و سهمیه از همان دادهٔ کاتالوگ خوانده می‌شوند. انتخاب ثابت، ترتیب مدیر و قواعد موجودی و دامنهٔ مجموعه را حفظ می‌کند. قابلیت ساخت Bundle پیشرفته تحت قرارداد سکشن‌های این مرحله عرضه نمی‌شود و پیشنهادهای موجود از قوانین ثبت‌شدهٔ فروش استفاده می‌کنند.

فهرست کامل با صفحه‌بندی سرور، لینک HTML، فیلتر و مرتب‌سازی موجود کار می‌کند. بارگذاری افزایشی فیلتر را حفظ می‌کند. بازگشت از جزئیات محصول نتایج افزوده و جای پیمایش را بازمی‌گرداند. پرش به انتهای فهرست یا فوتر، بارگذاری خودکار را متوقف می‌کند. مسیر عمومی و Canonical طبق قرارداد قبلی‌اند و صفحه‌های جشنواره `noindex, follow` می‌گیرند. مدل Prisma برای این تسک Migration تازه ندارد. پذیرش نهایی SEO و چرخهٔ انتشار در `FEST-11` انجام می‌شود.

## بررسی محلی

تست واحد API عبور از اولین دستهٔ نتیجه و توقف پس از پر شدن سکشن را می‌سنجد. E2E دیتابیس رسانه، ترتیب و تعداد انتخاب ثابت و زمان نمایش را بررسی می‌کند. تست Admin افزودن، حذف، بازترتیب و حفظ بخش همهٔ محصولات را می‌سنجد. Playwright مسیر فیلتر، صفحه‌بندی، تاریخچهٔ مرورگر، Canonical و دسترسی به فوتر را پوشش می‌دهد.

```bash
cd "/Users/amirhosseinhamidian/Projects/hamidian-silver" &&
DATABASE_URL='postgresql://schema:schema@127.0.0.1:5432/schema' pnpm contracts:generate &&
pnpm contracts:typecheck &&
pnpm api:lint &&
pnpm api:typecheck &&
pnpm api:test --runInBand modules/campaigns modules/catalog modules/authorization &&
pnpm frontend:lint &&
pnpm frontend:typecheck &&
pnpm admin:test festival-designer festival-theme-library &&
pnpm storefront:test catalog-product-grid &&
pnpm storefront:test:e2e campaign-landing.spec.ts
```

```bash
(
  cd "/Users/amirhosseinhamidian/Projects/hamidian-silver" || exit 1
  fest07_db="$(docker run -d --rm \
    -e POSTGRES_USER=hamidian -e POSTGRES_PASSWORD=fest07_local \
    -e POSTGRES_DB=hamidian_fest07_test -p 127.0.0.1::5432 postgres:18.6-alpine)" || exit 1
  trap 'docker stop "$fest07_db" >/dev/null' EXIT
  for attempt in {1..30}; do
    docker exec "$fest07_db" pg_isready -q -h 127.0.0.1 -U hamidian -d hamidian_fest07_test && break
    sleep 1
  done
  docker exec "$fest07_db" pg_isready -h 127.0.0.1 -U hamidian -d hamidian_fest07_test || exit 1
  fest07_address="$(docker port "$fest07_db" 5432/tcp)" || exit 1
  export DATABASE_URL="postgresql://hamidian:fest07_local@${fest07_address}/hamidian_fest07_test"
  pnpm exec prisma migrate deploy &&
  pnpm api:test:e2e --runInBand 'campaign-landing|campaign-lifecycle|festival-theme-library'
)
```

بازبینی دستی شامل Drag & Drop در دسکتاپ، جابه‌جایی با صفحه‌کلید یا لمس، رسانهٔ موبایل، دیدن فوتر با بارگذاری خودکار و سنجش زمان پاسخ با کاتالوگ پرتعداد است. پیش‌نمایش این مرحله از مسیر موجود استفاده می‌کند و پیش‌نمایش چهاراندازه در `FEST-08` می‌آید. نتیجهٔ تست، بازبینی دستی و SHA در انتظار ثبت‌اند.
