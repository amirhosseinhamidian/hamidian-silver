'use client';

import { useId, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { formatAdminInteger } from '@/lib/presentation/formatters';
import type { SiteSettingsReference } from '@/lib/site-settings/site-settings-model';

type OrderedSiteSelectionProps = Readonly<{
  label: string;
  description: string;
  options: readonly SiteSettingsReference[];
  selectedIds: readonly string[];
  max: number;
  disabled?: boolean;
  onChange: (ids: string[]) => void;
}>;

export function OrderedSiteSelection({
  label,
  description,
  options,
  selectedIds,
  max,
  disabled = false,
  onChange,
}: OrderedSiteSelectionProps) {
  const selectId = useId();
  const [candidateId, setCandidateId] = useState('');
  const byId = new Map(options.map((option) => [option.id, option] as const));
  const available = options.filter((option) => !selectedIds.includes(option.id));

  function move(index: number, offset: -1 | 1) {
    const target = index + offset;
    if (target < 0 || target >= selectedIds.length) return;
    const next = [...selectedIds];
    [next[index], next[target]] = [next[target]!, next[index]!];
    onChange(next);
  }

  return (
    <section className="rounded-[var(--admin-radius-md)] border border-[var(--admin-color-border)] p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold">{label}</h3>
          <p className="mt-1 text-xs leading-5 text-[var(--admin-color-muted)]">{description}</p>
        </div>
        <span className="text-xs font-bold text-[var(--admin-color-muted)]">
          {formatAdminInteger(selectedIds.length)} / {formatAdminInteger(max)}
        </span>
      </div>

      <div className="mt-4">
        <label
          htmlFor={selectId}
          className="block text-xs font-semibold text-[var(--admin-color-muted)]"
        >
          افزودن مورد
        </label>
        <Select
          id={selectId}
          aria-label={`افزودن به ${label}`}
          value={candidateId}
          placeholder="انتخاب کنید"
          disabled={disabled || selectedIds.length >= max || available.length === 0}
          onValueChange={(value) => {
            if (value) onChange([...selectedIds, value]);
            setCandidateId('');
          }}
          options={available.map((option) => ({ value: option.id, label: option.label }))}
          className="mt-1.5"
        />
      </div>

      {selectedIds.length ? (
        <ol className="mt-3 space-y-2">
          {selectedIds.map((id, index) => (
            <li
              key={id}
              className="flex items-center gap-2 rounded-lg bg-[var(--admin-color-surface-subtle)] p-2"
            >
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-white text-xs font-black">
                {formatAdminInteger(index + 1)}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                {byId.get(id)?.label ?? 'مورد حذف‌شده یا غیرفعال'}
              </span>
              <Button
                aria-label={`انتقال ${byId.get(id)?.label ?? id} به بالا`}
                variant="ghost"
                size="sm"
                disabled={disabled || index === 0}
                onClick={() => move(index, -1)}
              >
                ↑
              </Button>
              <Button
                aria-label={`انتقال ${byId.get(id)?.label ?? id} به پایین`}
                variant="ghost"
                size="sm"
                disabled={disabled || index === selectedIds.length - 1}
                onClick={() => move(index, 1)}
              >
                ↓
              </Button>
              <Button
                aria-label={`حذف ${byId.get(id)?.label ?? id}`}
                variant="ghost"
                size="sm"
                disabled={disabled}
                onClick={() => onChange(selectedIds.filter((candidate) => candidate !== id))}
              >
                حذف
              </Button>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-3 rounded-lg bg-[var(--admin-color-surface-subtle)] p-3 text-xs text-[var(--admin-color-muted)]">
          هنوز موردی انتخاب نشده است.
        </p>
      )}
    </section>
  );
}
