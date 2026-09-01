import type { ReactNode } from 'react';

interface TypographyProps {
  children: ReactNode;
  className?: string;
}

export function Typography({ children, className }: TypographyProps) {
  return <span className={className}>{children}</span>;
}
