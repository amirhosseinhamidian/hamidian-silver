import type { ReactNode } from 'react';

import { BottomSheet, BottomSheetContent, BottomSheetTrigger } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/ui/cn';

export type MobileDataCardItem = Readonly<{
  label: ReactNode;
  value: ReactNode;
}>;

type MobileDataCardProps = Readonly<{
  title: ReactNode;
  eyebrow?: ReactNode;
  status?: ReactNode;
  items: readonly MobileDataCardItem[];
  detailsTitle: ReactNode;
  detailsDescription?: ReactNode;
  detailsLabel?: ReactNode;
  details: ReactNode;
  detailsFooter?: ReactNode;
  detailsOpen?: boolean;
  onDetailsOpenChange?: (open: boolean) => void;
  className?: string;
}>;

export function MobileDataCard({
  title,
  eyebrow,
  status,
  items,
  detailsTitle,
  detailsDescription,
  detailsLabel = 'مشاهده جزئیات و عملیات',
  details,
  detailsFooter,
  detailsOpen,
  onDetailsOpenChange,
  className,
}: MobileDataCardProps) {
  return (
    <article
      className={cn(
        'rounded-[var(--admin-radius-lg)] border border-[var(--admin-color-border)] bg-[var(--admin-color-surface)] p-3 shadow-[var(--admin-shadow-sm)]',
        className,
      )}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {eyebrow ? (
            <div className="text-[0.6875rem] font-semibold text-[var(--admin-color-muted)]">
              {eyebrow}
            </div>
          ) : null}
          <h3 className={cn('truncate text-sm font-bold', Boolean(eyebrow) && 'mt-1')}>{title}</h3>
        </div>
        {status ? <div className="shrink-0">{status}</div> : null}
      </header>

      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 border-y border-[var(--admin-color-border)] py-2.5">
        {items.slice(0, 4).map((item, index) => (
          <div key={index} className="min-w-0">
            <dt className="text-[0.6875rem] text-[var(--admin-color-subtle)]">{item.label}</dt>
            <dd className="mt-0.5 truncate text-xs font-semibold text-[var(--admin-color-ink)]">
              {item.value}
            </dd>
          </div>
        ))}
      </dl>

      <BottomSheet open={detailsOpen} onOpenChange={onDetailsOpenChange}>
        <BottomSheetTrigger asChild>
          <Button variant="ghost" size="sm" className="mt-2 w-full">
            {detailsLabel}
          </Button>
        </BottomSheetTrigger>
        <BottomSheetContent
          title={detailsTitle}
          description={detailsDescription}
          footer={detailsFooter}
          height="large"
        >
          {details}
        </BottomSheetContent>
      </BottomSheet>
    </article>
  );
}
