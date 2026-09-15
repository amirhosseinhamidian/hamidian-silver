import type { ReactNode } from 'react';

export function EmptyState({
  title,
  description,
  action,
}: Readonly<{ title: string; description?: string; action?: ReactNode }>) {
  return (
    <div className="grid min-h-48 place-items-center rounded-[var(--admin-radius-lg)] border border-dashed border-[var(--admin-color-border-strong)] bg-[var(--admin-color-surface-subtle)] p-6 text-center">
      <div>
        <h2 className="font-bold">{title}</h2>
        {description ? (
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--admin-color-muted)]">
            {description}
          </p>
        ) : null}
        {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
      </div>
    </div>
  );
}
