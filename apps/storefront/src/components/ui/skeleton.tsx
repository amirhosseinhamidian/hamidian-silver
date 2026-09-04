import type { ComponentPropsWithoutRef } from 'react';

import { cn } from '@/lib/ui/cn';

type SkeletonProps = ComponentPropsWithoutRef<'div'>;

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'animate-pulse rounded-[var(--sf-radius-md)] bg-[var(--sf-color-surface-emphasis)]',
        className,
      )}
      {...props}
    />
  );
}
