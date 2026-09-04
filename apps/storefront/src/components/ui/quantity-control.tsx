'use client';

import { Button } from '@/components/ui/button';

const persianNumber = new Intl.NumberFormat('fa-IR');

type QuantityControlProps = Readonly<{
  value: number;
  min?: number;
  max: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  label?: string;
}>;

export function QuantityControl({
  value,
  min = 1,
  max,
  onChange,
  disabled = false,
  label = 'تعداد',
}: QuantityControlProps) {
  return (
    <div role="group" aria-label={label} className="inline-flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="icon"
        disabled={disabled || value <= min}
        aria-label="کاهش تعداد"
        onClick={() => onChange(Math.max(min, value - 1))}
      >
        −
      </Button>
      <output className="min-w-9 text-center text-sm" aria-live="polite">
        {persianNumber.format(value)}
      </output>
      <Button
        type="button"
        variant="outline"
        size="icon"
        disabled={disabled || value >= max}
        aria-label="افزایش تعداد"
        onClick={() => onChange(Math.min(max, value + 1))}
      >
        +
      </Button>
    </div>
  );
}
