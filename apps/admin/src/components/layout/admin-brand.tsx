import Link from 'next/link';

import { cn } from '@/lib/ui/cn';

export function AdminBrand({ inverse = false }: Readonly<{ inverse?: boolean }>) {
  return (
    <Link
      href="/"
      aria-label="داشبورد مدیریت نقره حمیدیان"
      className="inline-flex items-center gap-3 rounded-lg outline-none focus-visible:shadow-[var(--admin-focus-ring)]"
    >
      <span
        aria-hidden="true"
        className={cn(
          'grid size-10 place-items-center rounded-xl border text-lg font-black',
          inverse
            ? 'border-white/20 bg-white/10 text-white'
            : 'border-slate-300 bg-white text-slate-950',
        )}
      >
        H
      </span>
      <span>
        <span
          className={cn(
            'block text-xs font-black tracking-[0.14em]',
            inverse ? 'text-white' : 'text-slate-950',
          )}
        >
          HAMIDIAN
        </span>
        <span
          className={cn(
            'mt-0.5 block text-[0.6rem] tracking-[0.22em]',
            inverse ? 'text-slate-400' : 'text-slate-500',
          )}
        >
          SILVER ADMIN
        </span>
      </span>
    </Link>
  );
}
