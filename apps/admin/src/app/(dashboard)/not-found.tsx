import { ButtonLink } from '@/components/ui/button';

export default function DashboardNotFound() {
  return (
    <main className="admin-container py-10 sm:py-16">
      <section
        aria-labelledby="dashboard-not-found-title"
        className="mx-auto max-w-xl rounded-[var(--admin-radius-lg)] border border-[var(--admin-color-border)] bg-[var(--admin-color-surface)] p-6 text-center shadow-[var(--admin-shadow-md)] sm:p-8"
      >
        <p aria-hidden="true" className="text-sm font-bold text-[var(--admin-color-muted)]">
          ۴۰۴
        </p>
        <h1 id="dashboard-not-found-title" className="mt-3 text-2xl font-bold">
          این بخش از پنل پیدا نشد
        </h1>
        <p className="mt-3 text-sm leading-7 text-[var(--admin-color-muted)]">
          نشانی این بخش معتبر نیست یا صفحه از پنل حذف شده است.
        </p>
        <ButtonLink href="/" className="mt-6">
          بازگشت به داشبورد
        </ButtonLink>
      </section>
    </main>
  );
}
