'use client';

import { useState, type ComponentPropsWithoutRef, type ChangeEvent } from 'react';

import { Input } from '@/components/ui/form-control';
import {
  adminMoneyToWords,
  formatAdminMoneyInput,
  parseAdminMoneyInput,
  parseAdminWholeToman,
  toPersianDigits,
} from '@/lib/presentation/formatters';

type MoneyInputProps = Omit<ComponentPropsWithoutRef<'input'>, 'type' | 'inputMode'> & {
  wholeToman?: boolean;
};

export function MoneyInput({
  value,
  defaultValue,
  onChange,
  onFocus,
  onBlur,
  id,
  wholeToman = false,
  'aria-describedby': describedBy,
  ...props
}: MoneyInputProps) {
  const [editing, setEditing] = useState(false);
  function format(value: string) {
    if (!wholeToman) return formatAdminMoneyInput(value);
    const amount = parseAdminWholeToman(value);
    if (amount === null) return value;
    return editing ? toPersianDigits(amount) : formatAdminMoneyInput(amount);
  }
  const [localValue, setLocalValue] = useState(() => String(defaultValue ?? ''));
  const controlled = value !== undefined;
  const formattedValue = format(controlled ? String(value ?? '') : localValue);
  const amount = wholeToman
    ? parseAdminWholeToman(formattedValue)
    : parseAdminMoneyInput(formattedValue);
  const words = amount === null ? null : adminMoneyToWords(amount);
  const wordsId = id ? `${id}-words` : undefined;
  const inputDescribedBy = [describedBy, wordsId].filter(Boolean).join(' ') || undefined;

  function change(event: ChangeEvent<HTMLInputElement>) {
    const formatted = format(event.currentTarget.value);
    event.currentTarget.value = formatted;
    if (!controlled) setLocalValue(formatted);
    onChange?.(event);
  }

  return (
    <div className="space-y-1.5">
      <Input
        {...props}
        id={id}
        type="text"
        inputMode="numeric"
        value={formattedValue}
        aria-describedby={inputDescribedBy}
        onChange={change}
        onFocus={(event) => {
          if (wholeToman) setEditing(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          if (wholeToman) setEditing(false);
          onBlur?.(event);
        }}
      />
      <p
        id={wordsId}
        aria-live="polite"
        className="min-h-5 text-xs leading-5 text-[var(--admin-color-subtle)]"
      >
        {words ? `به حروف: ${words} تومان` : 'مبلغ به حروف پس از ورود نمایش داده می‌شود.'}
      </p>
    </div>
  );
}
