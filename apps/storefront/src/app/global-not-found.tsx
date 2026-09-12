import type { Metadata } from 'next';

import { ButtonLink } from '@/components/ui/button';
import { peyda } from '@/styles/fonts';

import './globals.css';

export const metadata: Metadata = {
  title: 'صفحه پیدا نشد | نقره حمیدیان',
  robots: { index: false, follow: false },
};

export default function GlobalNotFound() {
  return (
    <html lang="fa" dir="rtl" className={peyda.variable}>
      <body>
        <main id="main-content" className="sf-container grid min-h-dvh place-items-center py-12">
          <section
            aria-labelledby="global-not-found-title"
            className="w-full max-w-3xl border border-[var(--sf-color-border)] px-6 py-16 text-center sm:px-12 sm:py-24"
          >
            <p aria-hidden="true" className="text-sm text-[var(--sf-color-muted)]">
              ۴۰۴
            </p>
            <h1 id="global-not-found-title" className="mt-4 text-3xl font-medium sm:text-4xl">
              صفحه موردنظر پیدا نشد
            </h1>
            <p className="mt-4 text-sm leading-8 text-[var(--sf-color-muted)]">
              نشانی واردشده درست نیست یا صفحه دیگر وجود ندارد.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <ButtonLink href="/">بازگشت به صفحه اصلی</ButtonLink>
              <ButtonLink href="/products" variant="outline">
                مشاهده محصولات
              </ButtonLink>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
