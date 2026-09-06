import type { ReactNode } from 'react';

import { AdminShell } from '@/components/layout/admin-shell';
import { requireAdminSession } from '@/lib/auth/session';

type DashboardLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default async function DashboardLayout({ children }: DashboardLayoutProps) {
  await requireAdminSession();

  return <AdminShell>{children}</AdminShell>;
}
