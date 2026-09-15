import type { ComponentPropsWithoutRef } from 'react';

import { cn } from '@/lib/ui/cn';

const controlClassName = `
  sf-form-control min-h-11 w-full rounded-[var(--sf-radius-md)] border border-[var(--sf-color-border)] bg-transparent px-3
  text-sm text-[var(--sf-color-ink)] outline-none transition-colors
  placeholder:text-[var(--sf-color-subtle)]
  hover:border-[var(--sf-color-border-strong)]
  focus:border-[var(--sf-color-ink)]
  disabled:cursor-not-allowed disabled:bg-[var(--sf-color-surface)] disabled:opacity-60
  aria-[invalid=true]:border-[var(--sf-color-ink)]
`;

type InputProps = ComponentPropsWithoutRef<'input'> & {
  invalid?: boolean;
};

export function Input({ invalid = false, className, ...props }: InputProps) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={cn(controlClassName, className)}
      {...props}
    />
  );
}

type SelectProps = ComponentPropsWithoutRef<'select'> & {
  invalid?: boolean;
};

export function Select({ invalid = false, className, ...props }: SelectProps) {
  return (
    <select
      aria-invalid={invalid || undefined}
      className={cn(controlClassName, className)}
      {...props}
    />
  );
}

type TextareaProps = ComponentPropsWithoutRef<'textarea'> & {
  invalid?: boolean;
};

export function Textarea({ invalid = false, className, ...props }: TextareaProps) {
  return (
    <textarea
      aria-invalid={invalid || undefined}
      className={cn(controlClassName, 'min-h-28 resize-y py-3', className)}
      {...props}
    />
  );
}
