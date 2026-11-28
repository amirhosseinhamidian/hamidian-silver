'use client';

import * as SelectPrimitive from '@radix-ui/react-select';

import { useId, useState, type ComponentPropsWithoutRef } from 'react';

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
  required?: boolean;
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
  required = false,
  invalid = false,
  className,
  id,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
}: SelectProps) {
  const emptyOption = options.find((option) => option.value === '');
  const emptyItemValue = useId();
  const selectEmpty = Boolean(emptyOption && !emptyOption.disabled && !required);
  const [formValue, setFormValue] = useState(defaultValue ?? '');
  const emptyFormName = selectEmpty ? name : undefined;
  const toItemValue = (fieldValue: string | undefined) =>
    selectEmpty && fieldValue === '' ? emptyItemValue : fieldValue;

  return (
    <SelectPrimitive.Root
      dir="rtl"
      name={emptyFormName ? undefined : name}
      value={toItemValue(value)}
      defaultValue={toItemValue(defaultValue)}
      onValueChange={
        emptyOption
          ? (next) => {
              const fieldValue = next === emptyItemValue ? '' : next;
              if (emptyFormName) setFormValue(fieldValue);
              onValueChange?.(fieldValue);
            }
          : onValueChange
      }
      disabled={disabled}
      required={required}
    >
      <SelectPrimitive.Trigger
        id={id}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
        aria-invalid={invalid || ariaInvalid || undefined}
        className={cn(
          `
          sf-select-trigger

          group

          inline-flex
          min-h-11
          w-full
          items-center
          justify-between
          gap-3

          rounded-[var(--sf-radius-md)]

          border
          border-[var(--sf-color-border)]

          bg-[var(--sf-color-canvas)]

          px-3

          text-sm
          text-[var(--sf-color-ink)]

          outline-none

          transition-colors

          hover:border-[var(--sf-color-ink)]

          data-[state=open]:border-[var(--sf-color-ink)]

          focus:outline-none
          focus-visible:outline-none
          focus-visible:ring-0

          disabled:cursor-not-allowed
          disabled:bg-[var(--sf-color-surface)]
          disabled:opacity-60

          aria-[invalid=true]:border-[var(--sf-color-ink)]
          `,
          className,
        )}
      >
        <SelectPrimitive.Value placeholder={emptyOption?.label ?? placeholder} />

        <SelectPrimitive.Icon asChild>
          <FiChevronDown
            aria-hidden="true"
            size={16}
            className="
              shrink-0
              transition-transform
              duration-200

              group-data-[state=open]:rotate-180
            "
          />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>

      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          side="bottom"
          sideOffset={4}
          collisionPadding={12}
          className="
            z-[1000]

            min-w-[var(--radix-select-trigger-width)]

            overflow-hidden

            rounded-[var(--sf-radius-md)]

            border
            border-[var(--sf-color-border)]

            bg-[var(--sf-color-canvas)]

            shadow-[0_18px_50px_rgb(17_17_17/0.12)]
          "
        >
          <SelectPrimitive.Viewport
            className="
              max-h-56
              overflow-y-auto
              p-1
            "
          >
            {options.map((option) => (
              <SelectPrimitive.Item
                key={option.value}
                value={option.value || emptyItemValue}
                disabled={option.disabled || (required && option.value === '')}
                className="
                  relative

                  flex
                  min-h-10
                  select-none
                  items-center

                  cursor-pointer

                  rounded-[var(--sf-radius-md)]

                  border
                  border-transparent

                  py-2
                  pe-9
                  ps-3

                  text-sm
                  text-[var(--sf-color-ink)]

                  outline-none

                  transition-colors

                  hover:border-[var(--sf-color-ink)]

                  data-[highlighted]:border-[var(--sf-color-ink)]

                  data-[highlighted]:bg-transparent

                  data-[disabled]:pointer-events-none
                  data-[disabled]:opacity-40

                  focus:outline-none
                  focus-visible:outline-none
                  focus-visible:ring-0
                "
              >
                <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>

                <SelectPrimitive.ItemIndicator
                  className="
                    absolute
                    end-3
                  "
                >
                  <FiCheck aria-hidden="true" size={15} />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
      {/* Radix reserves the empty string. Keep it intact in submitted filter values. */}
      {emptyFormName && (
        <input type="hidden" name={emptyFormName} value={value ?? formValue} disabled={disabled} />
      )}
    </SelectPrimitive.Root>
  );
}
