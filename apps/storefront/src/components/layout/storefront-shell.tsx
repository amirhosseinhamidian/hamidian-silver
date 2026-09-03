import type { ReactNode } from 'react';

type StorefrontShellProps = Readonly<{
  children: ReactNode;
}>;

export function StorefrontShell({ children }: StorefrontShellProps) {
  return (
    <div
      data-app-shell="storefront"
      className="min-h-dvh bg-[var(--sf-color-canvas)] text-[var(--sf-color-ink)]"
    >
      <a href="#main-content" className="sf-skip-link">
        رفتن به محتوای اصلی
      </a>
      {children}
    </div>
  );
}
