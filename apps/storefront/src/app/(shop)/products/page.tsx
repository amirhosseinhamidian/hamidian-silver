export default function ProductsPage() {
  return (
    <main id="main-content" className="sf-container py-[var(--sf-section-space)]">
      <section aria-labelledby="products-title" className="max-w-[var(--sf-reading-max)]">
        <p className="mb-4 text-sm text-[var(--sf-color-muted)]">کاتالوگ فروشگاه</p>
        <h1 id="products-title" className="text-4xl font-normal sm:text-5xl">
          محصولات نقره حمیدیان
        </h1>
        <p className="mt-5 text-base leading-8 text-[var(--sf-color-muted)]">
          فهرست واقعی محصولات بعد از آماده شدن قرارداد عمومی کاتالوگ به این صفحه متصل می‌شود.
        </p>
      </section>
    </main>
  );
}
