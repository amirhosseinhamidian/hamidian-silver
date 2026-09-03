'use client';

import Link from 'next/link';

type CatalogRouteErrorProps = Readonly<{
  title: string;
  reset: () => void;
}>;

export function CatalogRouteError({ title, reset }: CatalogRouteErrorProps) {
  return (
    <main id="main-content" className="sf-container py-[var(--sf-section-space)]">
      <section className="border border-[var(--sf-color-border)] px-6 py-16 text-center">
        <h1 className="text-2xl font-medium">{title}</h1>
        <p className="mt-3 text-sm text-[var(--sf-color-muted)]">
          دریافت اطلاعات کاتالوگ با خطا روبه‌رو شد.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-5 text-sm">
          <button
            type="button"
            onClick={reset}
            className="border-b border-[var(--sf-color-ink)] pb-1"
          >
            تلاش دوباره
          </button>
          <Link href="/products" className="border-b border-[var(--sf-color-border-strong)] pb-1">
            همه محصولات
          </Link>
        </div>
      </section>
    </main>
  );
}
