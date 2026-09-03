import type { ReactNode } from 'react';

type TypographyVariant = 'display' | 'h1' | 'h2' | 'h3' | 'body' | 'caption';

interface TypographyProps {
  variant?: TypographyVariant;
  children: ReactNode;
  className?: string;
}

const variants: Record<TypographyVariant, string> = {
  display: 'text-4xl font-light tracking-tight',

  h1: 'text-3xl font-medium',

  h2: 'text-2xl font-medium',

  h3: 'text-xl font-medium',

  body: 'text-base font-normal',

  caption: 'text-sm font-normal',
};

export function Typography({ variant = 'body', children, className = '' }: TypographyProps) {
  return <span className={`${variants[variant]} ${className}`}>{children}</span>;
}
