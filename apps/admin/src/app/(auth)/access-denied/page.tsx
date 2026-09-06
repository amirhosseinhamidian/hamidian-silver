import type { Metadata } from 'next';

import { ButtonLink } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'عدم دسترسی',
};

export default function AccessDeniedPage() {
  return (
    <main className="grid min-h-dvh place-items-center bg-[var(--admin-color-canvas)] px-4 py-8">
      <section className="w-full max-w-md rounded-2xl border border-[var(--admin-color-border)] bg-[var(--admin-color-surface)] p-6 text-center shadow-[var(--admin-shadow-md)] sm:p-8">
        <span
          aria-hidden="true"
          className="mx-auto grid size-16 place-items-center rounded-full bg-[var(--admin-color-danger-soft)] text-[var(--admin-color-danger)]"
        >
          <svg viewBox="0 0 24 24" fill="none" className="size-8">
            <path
              d="M12 8v4m0 4h.01M10.3 3.8 2.7 17a2 2 0 0 0 1.73 3h15.14a2 2 0 0 0 1.73-3L13.7 3.8a2 2 0 0 0-3.4 0Z"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <p className="mt-5 text-xs font-bold text-[var(--admin-color-danger)]">دسترسی محدود</p>
        <h1 className="mt-2 text-xl font-bold sm:text-2xl">اجازه مشاهده این بخش را ندارید</h1>
        <p className="mt-3 text-sm leading-7 text-[var(--admin-color-muted)]">
          نقش یا سطح دسترسی حساب شما برای این عملیات کافی نیست. در صورت نیاز با مدیر سیستم تماس
          بگیرید.
        </p>
        <div className="mt-6 grid gap-2 sm:grid-cols-2">
          <ButtonLink href="/" variant="outline">
            بازگشت به داشبورد
          </ButtonLink>
          <ButtonLink href="/login">ورود با حساب دیگر</ButtonLink>
        </div>
      </section>
    </main>
  );
}
