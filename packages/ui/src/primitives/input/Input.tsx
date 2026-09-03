import type { InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className = '', ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-2">
      {label && <label className="text-sm">{label}</label>}

      <input
        className={[
          'w-full',
          'rounded-[var(--ui-radius)]',
          'border border-[var(--ui-border)]',
          'px-3',
          'py-2',
          'outline-none',
          'transition',
          'focus:ring-2',
          className,
        ].join(' ')}
        {...props}
      />

      {error && <span className="text-sm">{error}</span>}
    </div>
  );
}
