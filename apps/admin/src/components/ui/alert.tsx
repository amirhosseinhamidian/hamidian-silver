import type { ComponentPropsWithoutRef, ReactNode } from 'react';

import type { BadgeTone } from '@/components/ui/badge';
import { cn } from '@/lib/ui/cn';

const toneClassNames: Record<BadgeTone, string> = {
  neutral:
    'border-[var(--admin-color-border)] bg-[var(--admin-color-surface-subtle)] text-[var(--admin-color-ink)]',
  info: 'border-blue-200 bg-[var(--admin-color-info-soft)] text-[var(--admin-color-info)]',
  success:
    'border-emerald-200 bg-[var(--admin-color-success-soft)] text-[var(--admin-color-success)]',
  warning:
    'border-amber-200 bg-[var(--admin-color-warning-soft)] text-[var(--admin-color-warning)]',
  danger: 'border-red-200 bg-[var(--admin-color-danger-soft)] text-[var(--admin-color-danger)]',
};

type AlertProps = ComponentPropsWithoutRef<'div'> & {
  tone?: BadgeTone;
  title?: string;
  action?: ReactNode;
};

export function Alert({
  tone = 'neutral',
  title,
  action,
  className,
  children,
  ...props
}: AlertProps) {
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn(
        'flex items-start justify-between gap-4 rounded-[var(--admin-radius-md)] border p-3 text-sm',
        toneClassNames[tone],
        className,
      )}
      {...props}
    >
      <div className="min-w-0">
        {title ? <p className="font-bold">{title}</p> : null}
        <div className={cn('leading-6', title && 'mt-1')}>{children}</div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
