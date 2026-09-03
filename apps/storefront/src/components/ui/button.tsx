import Link from 'next/link';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';

import { cn } from '@/lib/ui/cn';

export type ButtonVariant = 'solid' | 'outline' | 'ghost' | 'text';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

const variantClasses: Record<ButtonVariant, string> = {
  solid: `
    border border-[var(--sf-color-ink)] bg-[var(--sf-color-ink)]
    text-[var(--sf-color-inverse)] hover:opacity-80
  `,
  outline: `
    border border-[var(--sf-color-border-strong)] bg-transparent
    text-[var(--sf-color-ink)] hover:border-[var(--sf-color-ink)]
  `,
  ghost: `
    border border-transparent bg-transparent text-[var(--sf-color-ink)]
    hover:bg-[var(--sf-color-surface)]
  `,
  text: `
    border-b border-[var(--sf-color-border-strong)] bg-transparent
    text-[var(--sf-color-ink)] hover:border-[var(--sf-color-ink)]
  `,
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'min-h-9 px-3 text-xs',
  md: 'min-h-11 px-5 text-sm',
  lg: 'min-h-12 px-7 text-sm',
  icon: 'size-11 p-0',
};

export function buttonClassName({
  variant = 'solid',
  size = 'md',
  className,
}: Readonly<{
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}> = {}): string {
  return cn(
    `
      inline-flex shrink-0 items-center justify-center gap-2
      font-medium transition-[background-color,border-color,opacity]
      duration-150 disabled:pointer-events-none disabled:opacity-45
    `,
    variantClasses[variant],
    sizeClasses[size],
    className,
  );
}

type ButtonProps = ComponentPropsWithoutRef<'button'> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
};

export function Button({
  variant = 'solid',
  size = 'md',
  loading = false,
  disabled,
  className,
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClassName({ variant, size, className })}
      {...props}
    >
      {loading ? (
        <span
          aria-hidden="true"
          className="size-3 animate-spin rounded-full border border-current border-t-transparent"
        />
      ) : null}
      {children}
    </button>
  );
}

type ButtonLinkProps = ComponentPropsWithoutRef<typeof Link> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
};

export function ButtonLink({
  variant = 'outline',
  size = 'md',
  className,
  children,
  ...props
}: ButtonLinkProps) {
  return (
    <Link className={buttonClassName({ variant, size, className })} {...props}>
      {children}
    </Link>
  );
}
