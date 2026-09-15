import type { Metadata } from 'next';

import { ButtonLink } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'صفحه پیدا نشد',
  robots: { index: false, follow: false },
};

export default function AdminNotFound() {
  return (
    <main className="grid min-h-dvh place-items-center bg-[var(--admin-color-canvas)] px-4 py-8">
      <section
        aria-labelledby="admin-not-found-title"
        className="w-full max-w-lg rounded-[var(--admin-radius-lg)] border border-[var(--admin-color-border)] bg-[var(--admin-color-surface)] p-6 text-center shadow-[var(--admin-shadow-md)] sm:p-8"
      >
        <p aria-hidden="true" className="text-sm font-bold text-[var(--admin-color-muted)]">
          ۴۰۴
        </p>
        <h1 id="admin-not-found-title" className="mt-3 text-2xl font-bold">
          این صفحه در پنل مدیریت پیدا نشد
        </h1>
        <p className="mt-3 text-sm leading-7 text-[var(--admin-color-muted)]">
          نشانی واردشده اشتباه است یا این بخش دیگر وجود ندارد. برای ادامه به داشبورد برگردید.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <ButtonLink href="/" variant="outline">
            بازگشت به داشبورد
          </ButtonLink>
          <ButtonLink href="/login">ورود به پنل</ButtonLink>
        </div>
      </section>
    </main>
  );
}
