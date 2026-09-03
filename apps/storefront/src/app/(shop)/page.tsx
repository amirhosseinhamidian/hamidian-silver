export default function StorefrontHomePage() {
  return (
    <main
      id="main-content"
      className="sf-container flex min-h-[70dvh] items-center py-[var(--sf-section-space)]"
    >
      <section aria-labelledby="storefront-title" className="max-w-[var(--sf-reading-max)]">
        <p
          className="mb-5 text-xs font-medium tracking-[0.24em] text-[var(--sf-color-muted)]"
          dir="ltr"
        >
          HAMIDIAN SILVER
        </p>
        <h1
          id="storefront-title"
          className="text-[clamp(2.75rem,7vw,6rem)] leading-[1.05] font-normal tracking-[-0.035em]"
        >
          فروشگاه نقره حمیدیان
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-8 text-[var(--sf-color-muted)] sm:text-lg">
          پایه بصری نسخه جدید فروشگاه با رویکرد مینیمال، تک‌رنگ و مبتنی بر فضای سفید آماده شده است.
          اجزای واقعی صفحه اصلی در مراحل بعد روی همین زیرساخت توسعه پیدا می‌کنند.
        </p>
      </section>
    </main>
  );
}
