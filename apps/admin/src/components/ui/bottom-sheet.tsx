'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { useId, type ComponentPropsWithoutRef, type ReactNode } from 'react';

import { cn } from '@/lib/ui/cn';

export const BottomSheet = DialogPrimitive.Root;
export const BottomSheetTrigger = DialogPrimitive.Trigger;
export const BottomSheetClose = DialogPrimitive.Close;

type BottomSheetHeight = 'content' | 'large' | 'full';

const heightClassNames: Record<BottomSheetHeight, string> = {
  content: 'max-h-[82dvh]',
  large: 'h-[82dvh]',
  full: 'h-[calc(100dvh-0.75rem)]',
};

type BottomSheetContentProps = Omit<
  ComponentPropsWithoutRef<typeof DialogPrimitive.Content>,
  'title'
> & {
  title: ReactNode;
  description?: ReactNode;
  footer?: ReactNode;
  height?: BottomSheetHeight;
  hideClose?: boolean;
};

function CloseIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="size-5" fill="none">
      <path
        d="m5 5 10 10M15 5 5 15"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function BottomSheetContent({
  title,
  description,
  footer,
  height = 'content',
  hideClose = false,
  className,
  children,
  'aria-describedby': ariaDescribedBy,
  ...props
}: BottomSheetContentProps) {
  const generatedDescriptionId = useId();
  const descriptionId = description ? generatedDescriptionId : ariaDescribedBy;

  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="admin-bottom-sheet-overlay fixed inset-0 z-[120] bg-slate-950/45 backdrop-blur-[2px]" />
      <DialogPrimitive.Content
        aria-describedby={descriptionId}
        className={cn(
          'admin-bottom-sheet-content fixed inset-x-0 bottom-0 z-[121] mx-auto flex w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-b-0 border-[var(--admin-color-border)] bg-[var(--admin-color-surface)] shadow-[var(--admin-shadow-lg)] outline-none',
          heightClassNames[height],
          className,
        )}
        {...props}
      >
        <div
          aria-hidden="true"
          className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-slate-300"
        />

        <header className="relative shrink-0 border-b border-[var(--admin-color-border)] px-4 py-3.5 ps-14">
          <DialogPrimitive.Title className="text-base font-bold text-[var(--admin-color-ink)]">
            {title}
          </DialogPrimitive.Title>
          {description ? (
            <DialogPrimitive.Description
              id={descriptionId}
              className="mt-1 text-xs leading-5 text-[var(--admin-color-muted)]"
            >
              {description}
            </DialogPrimitive.Description>
          ) : null}
          {!hideClose ? (
            <DialogPrimitive.Close
              aria-label="بستن"
              className="absolute start-3 top-2.5 grid size-9 place-items-center rounded-[var(--admin-radius-md)] text-[var(--admin-color-muted)] outline-none transition-colors hover:bg-[var(--admin-color-surface-hover)] hover:text-[var(--admin-color-ink)] focus-visible:shadow-[var(--admin-focus-ring)]"
            >
              <CloseIcon />
            </DialogPrimitive.Close>
          ) : null}
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">{children}</div>

        {footer ? (
          <footer className="flex shrink-0 gap-2 border-t border-[var(--admin-color-border)] bg-[var(--admin-color-surface)] px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] [&>*]:flex-1">
            {footer}
          </footer>
        ) : null}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
