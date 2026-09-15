import type { ReactNode } from 'react';

import { cn } from '@/lib/ui/cn';

type EmptyStateProps = Readonly<{
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}>;

export function EmptyState({ title, description, action, className }: EmptyStateProps) {
  return (
    <section className={cn('py-20 text-center', className)}>
      <h2 className="text-2xl font-medium">{title}</h2>
      {description ? (
        <p className="mt-3 text-sm leading-7 text-[var(--sf-color-muted)]">{description}</p>
      ) : null}
      {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
    </section>
  );
}
