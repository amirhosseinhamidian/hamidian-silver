import type { ReactNode } from 'react';

type StorefrontShellProps = Readonly<{
  children: ReactNode;
}>;

export function StorefrontShell({ children }: StorefrontShellProps) {
  return (
    <div data-app-shell="storefront" className="min-h-dvh">
      {children}
    </div>
  );
}
