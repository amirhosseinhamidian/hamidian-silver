'use client';

import * as DropdownPrimitive from '@radix-ui/react-dropdown-menu';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';

import { cn } from '@/lib/ui/cn';

export const DropdownMenuTrigger = DropdownPrimitive.Trigger;

export function DropdownMenu(props: ComponentPropsWithoutRef<typeof DropdownPrimitive.Root>) {
  return <DropdownPrimitive.Root dir="rtl" {...props} />;
}

export function DropdownMenuContent({
  className,
  sideOffset = 6,
  align = 'end',
  ...props
}: ComponentPropsWithoutRef<typeof DropdownPrimitive.Content>) {
  return (
    <DropdownPrimitive.Portal>
      <DropdownPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        collisionPadding={12}
        className={cn(
          'admin-dropdown-content z-[110] min-w-48 overflow-hidden rounded-[var(--admin-radius-md)] border border-[var(--admin-color-border)] bg-[var(--admin-color-surface)] p-1 shadow-[var(--admin-shadow-md)] outline-none',
          className,
        )}
        {...props}
      />
    </DropdownPrimitive.Portal>
  );
}

type DropdownMenuItemProps = ComponentPropsWithoutRef<typeof DropdownPrimitive.Item> & {
  icon?: ReactNode;
  shortcut?: string;
  tone?: 'default' | 'danger';
};

export function DropdownMenuItem({
  icon,
  shortcut,
  tone = 'default',
  className,
  children,
  ...props
}: DropdownMenuItemProps) {
  return (
    <DropdownPrimitive.Item
      className={cn(
        'flex min-h-9 cursor-pointer select-none items-center gap-2 rounded-[var(--admin-radius-sm)] px-2.5 text-sm outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-40 data-[highlighted]:bg-[var(--admin-color-surface-hover)]',
        tone === 'danger'
          ? 'text-[var(--admin-color-danger)] data-[highlighted]:bg-[var(--admin-color-danger-soft)]'
          : 'text-[var(--admin-color-ink)]',
        className,
      )}
      {...props}
    >
      {icon ? <span className="shrink-0 text-[var(--admin-color-muted)]">{icon}</span> : null}
      <span className="min-w-0 flex-1">{children}</span>
      {shortcut ? (
        <span className="text-[0.6875rem] text-[var(--admin-color-subtle)]" dir="ltr">
          {shortcut}
        </span>
      ) : null}
    </DropdownPrimitive.Item>
  );
}

export function DropdownMenuLabel({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof DropdownPrimitive.Label>) {
  return (
    <DropdownPrimitive.Label
      className={cn('px-2.5 py-2 text-xs font-bold text-[var(--admin-color-muted)]', className)}
      {...props}
    />
  );
}

export function DropdownMenuSeparator({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof DropdownPrimitive.Separator>) {
  return (
    <DropdownPrimitive.Separator
      className={cn('-mx-1 my-1 h-px bg-[var(--admin-color-border)]', className)}
      {...props}
    />
  );
}

function CheckIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4" fill="none">
      <path
        d="m4.5 10 3.5 3.5 7.5-7.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function DropdownMenuCheckboxItem({
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<typeof DropdownPrimitive.CheckboxItem>) {
  return (
    <DropdownPrimitive.CheckboxItem
      className={cn(
        'relative flex min-h-9 cursor-pointer select-none items-center rounded-[var(--admin-radius-sm)] py-1.5 pe-9 ps-2.5 text-sm text-[var(--admin-color-ink)] outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-40 data-[highlighted]:bg-[var(--admin-color-surface-hover)]',
        className,
      )}
      {...props}
    >
      <DropdownPrimitive.ItemIndicator className="absolute end-2.5 text-[var(--admin-color-primary)]">
        <CheckIcon />
      </DropdownPrimitive.ItemIndicator>
      {children}
    </DropdownPrimitive.CheckboxItem>
  );
}
