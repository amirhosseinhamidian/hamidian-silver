'use client';

type ProductsErrorProps = Readonly<{
  reset: () => void;
}>;

export default function ProductsError({ reset }: ProductsErrorProps) {
  return (
    <main
      id="main-content"
      className="sf-container py-[var(--sf-section-space)] text-center"
    >
      <h1 className="text-3xl font-medium">دریافت اطلاعات محصولات ممکن نشد</h1>
      <p className="mt-4 text-sm text-[var(--sf-color-muted)]">
        چند لحظه بعد دوباره تلاش کنید.
      </p>
      <button
        type="button"
        onClick={reset}
        className="
          mt-7 bg-[var(--sf-color-ink)] px-6 py-3 text-sm
          text-[var(--sf-color-inverse)]
        "
      >
        تلاش دوباره
      </button>
    </main>
  );
}
