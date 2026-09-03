import type { ReactNode } from 'react';

interface ToastProps {
  children: ReactNode;
}

export function Toast({ children }: ToastProps) {
  return (
    <div
      className="
        rounded-[var(--ui-radius)]
        border
        border-[var(--ui-border)]
        bg-[var(--background)]
        px-4
        py-3
        shadow
      "
    >
      {children}
    </div>
  );
}
