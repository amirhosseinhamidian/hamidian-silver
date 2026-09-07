import { ButtonLink } from '@/components/ui/button';

export default function ShopNotFound() {
  return (
    <main id="main-content" className="sf-container py-[var(--sf-section-space)]">
      <section
        aria-labelledby="storefront-not-found-title"
        className="mx-auto max-w-3xl border border-[var(--sf-color-border)] px-6 py-16 text-center sm:px-12 sm:py-24"
      >
        <p className="text-sm font-medium text-[var(--sf-color-muted)]" aria-hidden="true">
          ۴۰۴
        </p>
        <h1 id="storefront-not-found-title" className="mt-4 text-3xl font-medium sm:text-4xl">
          صفحه موردنظر پیدا نشد
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-8 text-[var(--sf-color-muted)]">
          ممکن است نشانی صفحه تغییر کرده باشد یا محتوای آن دیگر در دسترس نباشد.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <ButtonLink href="/">بازگشت به صفحه اصلی</ButtonLink>
          <ButtonLink href="/products" variant="outline">
            مشاهده محصولات
          </ButtonLink>
        </div>
      </section>
    </main>
  );
}
