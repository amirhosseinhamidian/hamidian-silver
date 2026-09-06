import type { ComponentPropsWithoutRef, ReactNode } from 'react';

import { cn } from '@/lib/ui/cn';

type CardProps = Omit<ComponentPropsWithoutRef<'section'>, 'title'> & {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
};

export function Card({ title, description, action, className, children, ...props }: CardProps) {
  return (
    <section
      className={cn(
        'rounded-[var(--admin-radius-lg)] border border-[var(--admin-color-border)] bg-[var(--admin-color-surface)] shadow-[var(--admin-shadow-sm)]',
        className,
      )}
      {...props}
    >
      {title || description || action ? (
        <header className="flex items-start justify-between gap-4 border-b border-[var(--admin-color-border)] px-4 py-3.5">
          <div className="min-w-0">
            {title ? <h2 className="font-bold text-[var(--admin-color-ink)]">{title}</h2> : null}
            {description ? (
              <p className="mt-1 text-xs leading-5 text-[var(--admin-color-muted)]">
                {description}
              </p>
            ) : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </header>
      ) : null}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Separator({ className }: Readonly<{ className?: string }>) {
  return <hr className={cn('border-0 border-t border-[var(--admin-color-border)]', className)} />;
}
