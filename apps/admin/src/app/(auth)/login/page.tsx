import type { Metadata } from 'next';

import { AdminLoginForm } from '@/components/auth/admin-login-form';
import { normalizeAdminReturnPath } from '@/lib/auth/login-redirect';

export const metadata: Metadata = {
  title: 'ورود',
};

type LoginPageProps = Readonly<{
  searchParams: Promise<{ next?: string | string[] }>;
}>;

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const nextPath = normalizeAdminReturnPath(params.next);

  return (
    <main className="grid min-h-dvh bg-[var(--admin-color-surface)] lg:grid-cols-[minmax(22rem,0.85fr)_minmax(32rem,1.15fr)]">
      <aside className="relative hidden overflow-hidden bg-[var(--admin-color-ink)] p-10 text-white lg:flex lg:flex-col lg:justify-between xl:p-14">
        <div
          aria-hidden="true"
          className="absolute -top-32 -left-32 size-96 rounded-full bg-blue-500/20 blur-3xl"
        />
        <div className="relative">
          <BrandMark inverse />
        </div>
        <div className="relative max-w-lg">
          <p className="text-sm font-semibold text-blue-300">مرکز عملیات فروشگاه</p>
          <h1 className="mt-4 text-3xl leading-[1.6] font-bold xl:text-4xl">
            تصمیم سریع، عملیات دقیق و دسترسی امن
          </h1>
          <p className="mt-4 max-w-md text-sm leading-7 text-slate-300">
            سفارش‌ها، موجودی، پرداخت‌ها و هشدارهای عملیاتی نقره حمیدیان در یک پنل متمرکز مدیریت
            می‌شوند.
          </p>
        </div>
        <p className="relative text-xs text-slate-400">دسترسی فقط برای کاربران مجاز</p>
      </aside>

      <section className="flex min-h-dvh items-center justify-center bg-[var(--admin-color-canvas)] px-4 py-8 sm:px-8 lg:px-12">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <BrandMark />
          </div>
          <AdminLoginForm nextPath={nextPath} />
          <p className="mt-5 text-center text-xs leading-5 text-[var(--admin-color-subtle)]">
            با ورود به پنل، فعالیت‌های حساس برای اهداف امنیتی ثبت می‌شوند.
          </p>
        </div>
      </section>
    </main>
  );
}

function BrandMark({ inverse = false }: Readonly<{ inverse?: boolean }>) {
  return (
    <div className="flex items-center gap-3" aria-label="نقره حمیدیان">
      <span
        aria-hidden="true"
        className={`grid size-11 place-items-center rounded-xl border text-xl font-black ${
          inverse
            ? 'border-white/25 bg-white/10 text-white'
            : 'border-slate-300 bg-white text-slate-950'
        }`}
      >
        H
      </span>
      <span>
        <span
          className={`block text-sm font-black tracking-[0.12em] ${inverse ? 'text-white' : 'text-slate-950'}`}
        >
          HAMIDIAN
        </span>
        <span
          className={`mt-0.5 block text-[0.65rem] tracking-[0.24em] ${inverse ? 'text-slate-400' : 'text-slate-500'}`}
        >
          SILVER ADMIN
        </span>
      </span>
    </div>
  );
}
