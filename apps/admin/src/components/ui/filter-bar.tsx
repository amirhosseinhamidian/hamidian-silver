import type { ComponentPropsWithoutRef, ReactNode } from 'react';

import { Input } from '@/components/ui/form-control';
import { formatAdminInteger } from '@/lib/presentation/formatters';
import { cn } from '@/lib/ui/cn';

type FilterBarProps = ComponentPropsWithoutRef<'section'> & {
  actions?: ReactNode;
  activeCount?: number;
  resetAction?: ReactNode;
};

export function FilterBar({
  actions,
  activeCount = 0,
  resetAction,
  className,
  children,
  ...props
}: FilterBarProps) {
  return (
    <section
      aria-label="فیلترها"
      className={cn(
        'rounded-[var(--admin-radius-lg)] border border-[var(--admin-color-border)] bg-[var(--admin-color-surface)] p-3 shadow-[var(--admin-shadow-sm)]',
        className,
      )}
      {...props}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(16rem,1.6fr)_repeat(2,minmax(10rem,1fr))]">
          {children}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
      </div>
      {activeCount > 0 || resetAction ? (
        <div className="mt-3 flex items-center justify-between gap-3 border-t border-[var(--admin-color-border)] pt-3 text-xs text-[var(--admin-color-muted)]">
          <span>{formatAdminInteger(activeCount)} فیلتر فعال</span>
          {resetAction}
        </div>
      ) : null}
    </section>
  );
}

function SearchIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4" fill="none">
      <circle cx="8.7" cy="8.7" r="5.2" stroke="currentColor" strokeWidth="1.6" />
      <path d="m12.6 12.6 3.4 3.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function SearchField({ className, ...props }: ComponentPropsWithoutRef<'input'>) {
  return (
    <div className={cn('relative', className)}>
      <span className="pointer-events-none absolute inset-y-0 start-3 grid place-items-center text-[var(--admin-color-subtle)]">
        <SearchIcon />
      </span>
      <Input type="search" className="ps-9" {...props} />
    </div>
  );
}
