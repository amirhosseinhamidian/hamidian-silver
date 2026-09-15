'use client';

import { CiTrash } from 'react-icons/ci';

import { Button } from '@/components/ui/button';

const persianNumber = new Intl.NumberFormat('fa-IR');

type QuantityControlProps = Readonly<{
  value: number;
  min?: number;
  max: number;
  onChange: (value: number) => void;
  onRemove?: () => void;
  disabled?: boolean;
  label?: string;
  compact?: boolean;
}>;

export function QuantityControl({
  value,
  min = 1,
  max,
  onChange,
  onRemove,
  disabled = false,
  label = 'تعداد',
  compact = false,
}: QuantityControlProps) {
  const showRemove = value <= min && onRemove !== undefined;

  return (
    <div
      role="group"
      aria-label={label}
      className={`inline-flex items-center ${compact ? 'gap-1' : 'gap-2'}`}
    >
      <Button
        type="button"
        variant="outline"
        size={compact ? 'sm' : 'icon'}
        className={compact ? 'min-w-9 px-2' : undefined}
        disabled={disabled || (!showRemove && value <= min)}
        aria-label={showRemove ? 'حذف از سبد خرید' : 'کاهش تعداد'}
        title={showRemove ? 'حذف از سبد خرید' : undefined}
        onClick={() => {
          if (showRemove) {
            onRemove();
            return;
          }

          onChange(Math.max(min, value - 1));
        }}
      >
        {showRemove ? <CiTrash aria-hidden="true" size={18} /> : '−'}
      </Button>
      <output
        className={`${compact ? 'min-w-7 text-base' : 'min-w-9 text-lg'} text-center font-semibold`}
        aria-live="polite"
      >
        {persianNumber.format(value)}
      </output>
      <Button
        type="button"
        variant="outline"
        size={compact ? 'sm' : 'icon'}
        className={compact ? 'min-w-9 px-2' : undefined}
        disabled={disabled || value >= max}
        aria-label="افزایش تعداد"
        onClick={() => onChange(Math.min(max, value + 1))}
      >
        +
      </Button>
    </div>
  );
}
