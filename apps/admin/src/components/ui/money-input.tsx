'use client';

import { useState, type ComponentPropsWithoutRef, type ChangeEvent } from 'react';

import { Input } from '@/components/ui/form-control';
import {
  adminMoneyToWords,
  formatAdminMoneyInput,
  parseAdminMoneyInput,
} from '@/lib/presentation/formatters';

type MoneyInputProps = Omit<ComponentPropsWithoutRef<'input'>, 'type' | 'inputMode'>;

export function MoneyInput({
  value,
  defaultValue,
  onChange,
  id,
  'aria-describedby': describedBy,
  ...props
}: MoneyInputProps) {
  const [localValue, setLocalValue] = useState(() =>
    formatAdminMoneyInput(String(defaultValue ?? '')),
  );
  const controlled = value !== undefined;
  const formattedValue = controlled ? formatAdminMoneyInput(String(value ?? '')) : localValue;
  const amount = parseAdminMoneyInput(formattedValue);
  const words = amount === null ? null : adminMoneyToWords(amount);
  const wordsId = id ? `${id}-words` : undefined;
  const inputDescribedBy = [describedBy, wordsId].filter(Boolean).join(' ') || undefined;

  function change(event: ChangeEvent<HTMLInputElement>) {
    const formatted = formatAdminMoneyInput(event.currentTarget.value);
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
