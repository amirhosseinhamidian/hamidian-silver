import type { ComponentPropsWithoutRef } from 'react';

import { cn } from '@/lib/ui/cn';

export type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

const toneClassNames: Record<BadgeTone, string> = {
  neutral:
    'border-[var(--admin-color-border)] bg-[var(--admin-color-surface-subtle)] text-[var(--admin-color-muted)]',
  info: 'border-blue-200 bg-[var(--admin-color-info-soft)] text-[var(--admin-color-info)]',
  success:
    'border-emerald-200 bg-[var(--admin-color-success-soft)] text-[var(--admin-color-success)]',
  warning:
    'border-amber-200 bg-[var(--admin-color-warning-soft)] text-[var(--admin-color-warning)]',
  danger: 'border-red-200 bg-[var(--admin-color-danger-soft)] text-[var(--admin-color-danger)]',
};

type BadgeProps = ComponentPropsWithoutRef<'span'> & {
  tone?: BadgeTone;
  dot?: boolean;
};

export function Badge({
  tone = 'neutral',
  dot = false,
  className,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex min-h-6 items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold whitespace-nowrap',
        toneClassNames[tone],
        className,
      )}
      {...props}
    >
      {dot ? <span aria-hidden="true" className="size-1.5 rounded-full bg-current" /> : null}
      {children}
    </span>
  );
}
