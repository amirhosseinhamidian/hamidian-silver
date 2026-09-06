import Link from 'next/link';
import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from 'react';

import { cn } from '@/lib/ui/cn';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

const baseClassName =
  'inline-flex items-center justify-center gap-2 rounded-[var(--admin-radius-md)] font-semibold outline-none transition-colors focus-visible:shadow-[var(--admin-focus-ring)] disabled:pointer-events-none disabled:opacity-50';

const variantClassNames: Record<ButtonVariant, string> = {
  primary:
    'border border-[var(--admin-color-primary)] bg-[var(--admin-color-primary)] text-white hover:border-[var(--admin-color-primary-hover)] hover:bg-[var(--admin-color-primary-hover)]',
  secondary:
    'border border-[var(--admin-color-primary-soft)] bg-[var(--admin-color-primary-soft)] text-[var(--admin-color-primary)] hover:border-blue-100 hover:bg-blue-100',
  outline:
    'border border-[var(--admin-color-border)] bg-[var(--admin-color-surface)] text-[var(--admin-color-ink)] hover:border-[var(--admin-color-border-strong)] hover:bg-[var(--admin-color-surface-subtle)]',
  ghost:
    'border border-transparent bg-transparent text-[var(--admin-color-muted)] hover:bg-[var(--admin-color-surface-hover)] hover:text-[var(--admin-color-ink)]',
  danger:
    'border border-[var(--admin-color-danger)] bg-[var(--admin-color-danger)] text-white hover:border-[var(--admin-color-danger-hover)] hover:bg-[var(--admin-color-danger-hover)]',
};

const sizeClassNames: Record<ButtonSize, string> = {
  sm: 'min-h-8 px-2.5 text-xs',
  md: 'min-h-10 px-3.5 text-sm',
  lg: 'min-h-11 px-4 text-sm',
};

function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="admin-spinner size-4 rounded-full border-2 border-current border-e-transparent"
    />
  );
}

type ButtonProps = ComponentPropsWithoutRef<'button'> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leadingIcon?: ReactNode;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    leadingIcon,
    className,
    children,
    disabled,
    type = 'button',
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(baseClassName, variantClassNames[variant], sizeClassNames[size], className)}
      {...props}
    >
      {loading ? <Spinner /> : leadingIcon}
      <span>{children}</span>
    </button>
  );
});

type ButtonLinkProps = ComponentPropsWithoutRef<typeof Link> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  leadingIcon?: ReactNode;
};

export function ButtonLink({
  variant = 'primary',
  size = 'md',
  leadingIcon,
  className,
  children,
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      className={cn(baseClassName, variantClassNames[variant], sizeClassNames[size], className)}
      {...props}
    >
      {leadingIcon}
      <span>{children}</span>
    </Link>
  );
}

type IconButtonProps = Omit<ButtonProps, 'children'> & {
  label: string;
  children: ReactNode;
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, children, className, ...props },
  ref,
) {
  return (
    <Button ref={ref} aria-label={label} className={cn('aspect-square px-0', className)} {...props}>
      <span aria-hidden="true">{children}</span>
    </Button>
  );
});
