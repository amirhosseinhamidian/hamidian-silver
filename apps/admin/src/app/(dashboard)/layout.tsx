import { AdminShell } from '@/components/layout/admin-shell';
import type { ReactNode } from 'react';

type DashboardLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return <AdminShell>{children}</AdminShell>;
}
