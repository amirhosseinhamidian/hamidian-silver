import type { ComponentPropsWithoutRef } from 'react';

import { cn } from '@/lib/ui/cn';

export function Skeleton({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'animate-pulse rounded-[var(--admin-radius-sm)] bg-[var(--admin-color-border)]/70',
        className,
      )}
      {...props}
    />
  );
}

export function Spinner({ label = 'در حال بارگذاری' }: Readonly<{ label?: string }>) {
  return (
    <span
      role="status"
      className="inline-flex items-center gap-2 text-sm text-[var(--admin-color-muted)]"
    >
      <span
        aria-hidden="true"
        className="admin-spinner size-4 rounded-full border-2 border-[var(--admin-color-border-strong)] border-e-[var(--admin-color-primary)]"
      />
      <span>{label}</span>
    </span>
  );
}
