import Link from 'next/link';

export default function CategoryNotFound() {
  return (
    <main id="main-content" className="sf-container py-[var(--sf-section-space)]">
      <section className="py-20 text-center">
        <h1 className="text-3xl font-medium">دسته‌بندی پیدا نشد</h1>
        <p className="mt-3 text-sm text-[var(--sf-color-muted)]">
          این دسته‌بندی در کاتالوگ فعال فروشگاه وجود ندارد.
        </p>
        <Link
          href="/products"
          className="
            mt-6 inline-block border-b border-[var(--sf-color-ink)]
            pb-1 text-sm
          "
        >
          مشاهده همه محصولات
        </Link>
      </section>
    </main>
  );
}
