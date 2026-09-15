'use client';

import { Button, ButtonLink } from '@/components/ui/button';

type AdminErrorStateProps = Readonly<{
  title?: string;
  description?: string;
  onRetry: () => void;
  fullPage?: boolean;
}>;

export function AdminErrorState({
  title = 'بارگذاری پنل انجام نشد',
  description = 'ارتباط با سرویس مدیریت برقرار نشد یا خطای موقتی رخ داده است.',
  onRetry,
  fullPage = false,
}: AdminErrorStateProps) {
  return (
    <main
      role="alert"
      className={
        fullPage
          ? 'grid min-h-dvh place-items-center bg-[var(--admin-color-canvas)] px-4 py-8'
          : 'admin-container py-8 sm:py-12'
      }
    >
      <section className="mx-auto w-full max-w-lg rounded-[var(--admin-radius-lg)] border border-[var(--admin-color-border)] bg-[var(--admin-color-surface)] p-6 text-center shadow-[var(--admin-shadow-md)] sm:p-8">
        <p className="text-xs font-bold text-[var(--admin-color-danger)]">خطای موقت</p>
        <h1 className="mt-2 text-xl font-bold text-[var(--admin-color-ink)] sm:text-2xl">
          {title}
        </h1>
        <p className="mt-3 text-sm leading-7 text-[var(--admin-color-muted)]">{description}</p>
        <div className="mt-6 grid gap-2 sm:grid-cols-2">
          <Button variant="primary" onClick={onRetry}>
            تلاش دوباره
          </Button>
          <ButtonLink href="/login" variant="outline">
            ورود دوباره
          </ButtonLink>
        </div>
      </section>
    </main>
  );
}
