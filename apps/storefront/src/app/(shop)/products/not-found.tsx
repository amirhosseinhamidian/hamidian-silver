import Link from 'next/link';

export default function ProductNotFound() {
  return (
    <main
      id="main-content"
      className="sf-container py-[var(--sf-section-space)] text-center"
    >
      <h1 className="text-3xl font-medium">این محصول پیدا نشد</h1>
      <p className="mt-4 text-sm text-[var(--sf-color-muted)]">
        ممکن است محصول حذف شده یا دیگر برای فروش فعال نباشد.
      </p>
      <Link
        href="/products"
        className="
          mt-7 inline-block border-b border-[var(--sf-color-ink)]
          pb-1 text-sm
        "
      >
        بازگشت به محصولات
      </Link>
    </main>
  );
}
