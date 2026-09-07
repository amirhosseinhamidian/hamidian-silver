'use client';

import { Button, ButtonLink } from '@/components/ui/button';

type ShopErrorProps = Readonly<{
  error: Error & { digest?: string };
  reset: () => void;
}>;

export default function ShopError({ reset }: ShopErrorProps) {
  return (
    <main id="main-content" className="sf-container py-[var(--sf-section-space)]">
      <section
        role="alert"
        aria-labelledby="storefront-error-title"
        className="mx-auto max-w-3xl border border-[var(--sf-color-border)] px-6 py-16 text-center sm:px-12 sm:py-24"
      >
        <p className="text-xs tracking-[0.18em] text-[var(--sf-color-muted)]">اختلال موقت</p>
        <h1 id="storefront-error-title" className="mt-4 text-3xl font-medium sm:text-4xl">
          این صفحه فعلاً در دسترس نیست
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-8 text-[var(--sf-color-muted)]">
          هنگام دریافت اطلاعات مشکلی پیش آمد. چند لحظه دیگر دوباره تلاش کنید یا به صفحه اصلی
          برگردید.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button type="button" onClick={reset}>
            تلاش دوباره
          </Button>
          <ButtonLink href="/" variant="outline">
            بازگشت به صفحه اصلی
          </ButtonLink>
        </div>
      </section>
    </main>
  );
}
