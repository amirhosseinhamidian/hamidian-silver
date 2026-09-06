'use client';

import * as SelectPrimitive from '@radix-ui/react-select';
import type { ComponentPropsWithoutRef } from 'react';

import { cn } from '@/lib/ui/cn';

export type SelectOption = Readonly<{
  value: string;
  label: string;
  disabled?: boolean;
}>;

type SelectProps = Readonly<{
  name?: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  options: readonly SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  invalid?: boolean;
  className?: string;
}> &
  Pick<
    ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>,
    'id' | 'aria-label' | 'aria-describedby' | 'aria-invalid'
  >;

function ChevronDown() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4" fill="none">
      <path
        d="m5 7.5 5 5 5-5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Check() {
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

export function Select({
  name,
  value,
  defaultValue,
  onValueChange,
  options,
  placeholder = 'انتخاب کنید',
  disabled = false,
  required = false,
  invalid = false,
  className,
  id,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
}: SelectProps) {
  return (
    <SelectPrimitive.Root
      dir="rtl"
      name={name}
      value={value}
      defaultValue={defaultValue}
      onValueChange={onValueChange}
      disabled={disabled}
      required={required}
    >
      <SelectPrimitive.Trigger
        id={id}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
        aria-invalid={invalid || ariaInvalid || undefined}
        className={cn(
          'admin-select-trigger group inline-flex min-h-10 w-full items-center justify-between gap-3 rounded-[var(--admin-radius-md)] border border-[var(--admin-color-border)] bg-[var(--admin-color-surface)] px-3 text-sm text-[var(--admin-color-ink)] shadow-[var(--admin-shadow-sm)] outline-none transition-[border-color,box-shadow] hover:border-[var(--admin-color-border-strong)] focus:border-[var(--admin-color-primary)] focus:shadow-[var(--admin-focus-ring)] data-[state=open]:border-[var(--admin-color-primary)] data-[state=open]:shadow-[var(--admin-focus-ring)] disabled:cursor-not-allowed disabled:bg-[var(--admin-color-surface-subtle)] disabled:opacity-70 aria-[invalid=true]:border-[var(--admin-color-danger)]',
          className,
        )}
      >
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon asChild>
          <span className="shrink-0 text-[var(--admin-color-muted)] transition-transform group-data-[state=open]:rotate-180">
            <ChevronDown />
          </span>
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>

      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={5}
          collisionPadding={12}
          className="z-[100] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-[var(--admin-radius-md)] border border-[var(--admin-color-border)] bg-[var(--admin-color-surface)] shadow-[var(--admin-shadow-md)]"
        >
          <SelectPrimitive.Viewport className="max-h-72 overflow-y-auto p-1">
            {options.map((option) => (
              <SelectPrimitive.Item
                key={option.value}
                value={option.value}
                disabled={option.disabled}
                className="relative flex min-h-9 cursor-pointer select-none items-center rounded-[var(--admin-radius-sm)] py-1.5 pe-9 ps-3 text-sm outline-none data-[highlighted]:bg-[var(--admin-color-primary-soft)] data-[highlighted]:text-[var(--admin-color-primary)] data-[disabled]:pointer-events-none data-[disabled]:opacity-40"
              >
                <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator className="absolute end-3 text-[var(--admin-color-primary)]">
                  <Check />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
