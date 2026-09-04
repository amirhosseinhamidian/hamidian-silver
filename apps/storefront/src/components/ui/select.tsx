'use client';

import * as SelectPrimitive from '@radix-ui/react-select';
import type { ComponentPropsWithoutRef } from 'react';
import { FiCheck, FiChevronDown } from 'react-icons/fi';

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
  invalid?: boolean;
  className?: string;
}> &
  Pick<
    ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>,
    'id' | 'aria-label' | 'aria-describedby' | 'aria-invalid'
  >;

export function Select({
  name,
  value,
  defaultValue,
  onValueChange,
  options,
  placeholder = 'انتخاب کنید',
  disabled = false,
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
    >
      <SelectPrimitive.Trigger
        id={id}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
        aria-invalid={invalid || ariaInvalid || undefined}
        className={cn(
          `
            sf-select-trigger inline-flex min-h-11 w-full items-center justify-between gap-3
            rounded-[var(--sf-radius-md)] border border-[var(--sf-color-border)]
            bg-[var(--sf-color-canvas)] px-3 text-sm
            text-[var(--sf-color-ink)] outline-none transition-colors
            hover:border-[var(--sf-color-border-strong)]
            focus:border-[var(--sf-color-ink)]
            disabled:cursor-not-allowed disabled:bg-[var(--sf-color-surface)]
            disabled:opacity-60 aria-[invalid=true]:border-[var(--sf-color-ink)]
          `,
          className,
        )}
      >
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon asChild>
          <FiChevronDown aria-hidden="true" className="shrink-0" size={16} />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>

      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          side="bottom"
          sideOffset={4}
          collisionPadding={12}
          className="
            z-[80] min-w-[var(--radix-select-trigger-width)] overflow-hidden
            rounded-[var(--sf-radius-md)] border border-[var(--sf-color-border)]
            bg-[var(--sf-color-canvas)] shadow-[0_18px_50px_rgb(17_17_17/0.12)]
            data-[state=closed]:animate-[sf-select-close_420ms_cubic-bezier(0.16,1,0.3,1)_forwards]
            data-[state=open]:animate-[sf-select-open_520ms_cubic-bezier(0.16,1,0.3,1)]
          "
        >
          <SelectPrimitive.Viewport className="max-h-72 p-1">
            {options.map((option) => (
              <SelectPrimitive.Item
                key={option.value}
                value={option.value}
                disabled={option.disabled}
                className="
                  relative flex min-h-10 select-none items-center
                  rounded-[var(--sf-radius-md)] py-2 pe-9 ps-3 text-sm outline-none
                  data-[disabled]:pointer-events-none data-[disabled]:opacity-40
                  data-[highlighted]:bg-[var(--sf-color-surface-emphasis)]
                "
              >
                <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator className="absolute end-3">
                  <FiCheck aria-hidden="true" size={15} />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
