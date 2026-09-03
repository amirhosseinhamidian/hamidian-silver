import type { ReactNode } from 'react';

type AdminShellProps = Readonly<{
  children: ReactNode;
}>;

export function AdminShell({ children }: AdminShellProps) {
  return (
    <div data-app-shell="admin" className="min-h-dvh">
      {children}
    </div>
  );
}
