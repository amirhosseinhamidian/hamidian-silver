import type { ComponentPropsWithoutRef } from 'react';

import { cn } from '@/lib/ui/cn';

const controlClassName =
  'admin-form-control min-h-10 w-full rounded-[var(--admin-radius-md)] border border-[var(--admin-color-border)] bg-[var(--admin-color-surface)] px-3 text-sm text-[var(--admin-color-ink)] shadow-[var(--admin-shadow-sm)] outline-none transition-[border-color,box-shadow] placeholder:text-[var(--admin-color-subtle)] hover:border-[var(--admin-color-border-strong)] focus:border-[var(--admin-color-primary)] focus:shadow-[var(--admin-focus-ring)] disabled:cursor-not-allowed disabled:bg-[var(--admin-color-surface-subtle)] disabled:opacity-70 aria-[invalid=true]:border-[var(--admin-color-danger)] aria-[invalid=true]:shadow-[0_0_0_3px_rgb(180_35_24_/_10%)]';

type InputProps = ComponentPropsWithoutRef<'input'> & { invalid?: boolean };

export function Input({ invalid = false, className, ...props }: InputProps) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={cn(controlClassName, className)}
      {...props}
    />
  );
}

type TextareaProps = ComponentPropsWithoutRef<'textarea'> & { invalid?: boolean };

export function Textarea({ invalid = false, className, ...props }: TextareaProps) {
  return (
    <textarea
      aria-invalid={invalid || undefined}
      className={cn(controlClassName, 'min-h-24 resize-y py-2.5 leading-6', className)}
      {...props}
    />
  );
}
