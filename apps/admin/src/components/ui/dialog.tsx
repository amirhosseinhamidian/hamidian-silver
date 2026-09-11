'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { useId, type ComponentPropsWithoutRef, type ReactNode } from 'react';

import { cn } from '@/lib/ui/cn';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

type DialogSize = 'sm' | 'md' | 'lg';

const sizeClassNames: Record<DialogSize, string> = {
  sm: 'sm:max-w-md',
  md: 'sm:max-w-xl',
  lg: 'sm:max-w-3xl',
};

type DialogContentProps = Omit<
  ComponentPropsWithoutRef<typeof DialogPrimitive.Content>,
  'title'
> & {
  title: ReactNode;
  description?: ReactNode;
  footer?: ReactNode;
  size?: DialogSize;
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

export function DialogContent({
  title,
  description,
  footer,
  size = 'md',
  hideClose = false,
  className,
  children,
  'aria-describedby': ariaDescribedBy,
  ...props
}: DialogContentProps) {
  const generatedDescriptionId = useId();
  const descriptionId = description ? generatedDescriptionId : ariaDescribedBy;

  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="admin-dialog-overlay fixed inset-0 z-[100] bg-slate-950/45 backdrop-blur-[2px]" />
      <DialogPrimitive.Content
        aria-describedby={descriptionId}
        className={cn(
          'admin-dialog-content fixed inset-x-3 top-1/2 z-[101] max-h-[calc(100dvh-1.5rem)] -translate-y-1/2 overflow-y-auto rounded-[var(--admin-radius-lg)] border border-[var(--admin-color-border)] bg-[var(--admin-color-surface)] shadow-[var(--admin-shadow-lg)] outline-none sm:inset-x-auto sm:left-1/2 sm:w-[calc(100%-3rem)] sm:-translate-x-1/2',
          sizeClassNames[size],
          className,
        )}
        {...props}
      >
        <header className="border-b border-[var(--admin-color-border)] px-5 py-4 ps-14">
          <DialogPrimitive.Title className="text-base font-bold text-[var(--admin-color-ink)] sm:text-lg">
            {title}
          </DialogPrimitive.Title>
          {description ? (
            <DialogPrimitive.Description
              id={descriptionId}
              className="mt-1.5 text-sm leading-6 text-[var(--admin-color-muted)]"
            >
              {description}
            </DialogPrimitive.Description>
          ) : null}
        </header>

        {!hideClose ? (
          <DialogPrimitive.Close
            aria-label="بستن"
            className="absolute start-4 top-3.5 grid size-9 place-items-center rounded-[var(--admin-radius-md)] text-[var(--admin-color-muted)] outline-none transition-colors hover:bg-[var(--admin-color-surface-hover)] hover:text-[var(--admin-color-ink)] focus-visible:shadow-[var(--admin-focus-ring)]"
          >
            <CloseIcon />
          </DialogPrimitive.Close>
        ) : null}

        <div className="p-5">{children}</div>

        {footer ? (
          <footer className="flex flex-col-reverse gap-2 border-t border-[var(--admin-color-border)] bg-[var(--admin-color-surface-subtle)] px-5 py-4 sm:flex-row sm:justify-end">
            {footer}
          </footer>
        ) : null}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
