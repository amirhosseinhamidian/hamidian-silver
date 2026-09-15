import type { ComponentPropsWithoutRef, ReactNode } from 'react';

import { cn } from '@/lib/ui/cn';

type CheckboxProps = Omit<ComponentPropsWithoutRef<'input'>, 'type'> & {
  label: ReactNode;
  description?: ReactNode;
};

export function Checkbox({ label, description, className, id, ...props }: CheckboxProps) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-2.5">
      <input
        id={id}
        type="checkbox"
        className={cn(
          'mt-0.5 size-4 shrink-0 accent-[var(--admin-color-primary)] focus-visible:shadow-[var(--admin-focus-ring)]',
          className,
        )}
        {...props}
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-[var(--admin-color-ink)]">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-xs leading-5 text-[var(--admin-color-muted)]">
            {description}
          </span>
        ) : null}
      </span>
    </label>
  );
}
