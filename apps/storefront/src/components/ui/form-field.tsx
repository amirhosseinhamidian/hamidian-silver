import type { ReactNode } from 'react';

import { cn } from '@/lib/ui/cn';

export type FormFieldControlProps = Readonly<{
  id: string;
  'aria-describedby'?: string;
  'aria-invalid'?: true;
}>;

type FormFieldProps = Readonly<{
  id: string;
  label: string;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  className?: string;
  children: (controlProps: FormFieldControlProps) => ReactNode;
}>;

export function FormField({
  id,
  label,
  hint,
  error,
  required = false,
  className,
  children,
}: FormFieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <label htmlFor={id} className="text-xs text-[var(--sf-color-muted)]">
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </label>

      {children({
        id,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : undefined,
      })}

      {hint ? (
        <p id={hintId} className="text-xs leading-5 text-[var(--sf-color-subtle)]">
          {hint}
        </p>
      ) : null}

      {error ? (
        <p id={errorId} role="alert" className="text-xs leading-5 text-[var(--sf-color-ink)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
