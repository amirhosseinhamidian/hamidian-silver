import type { ReactNode } from 'react';

import { AdminShell } from '@/components/layout/admin-shell';
import { requireAdminSession } from '@/lib/auth/session';
import { getAdminNavigation } from '@/lib/navigation/admin-navigation';

type DashboardLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default async function DashboardLayout({ children }: DashboardLayoutProps) {
  const user = await requireAdminSession();
  const navigation = getAdminNavigation(user);
  const roleLabel = user.roles.includes('MANAGER') ? 'مدیر ارشد' : 'ادمین عملیات';

  return (
    <AdminShell
      account={{
        phone: user.phone,
        roleLabel,
        initials: roleLabel.slice(0, 2),
      }}
      navigation={navigation}
    >
      {children}
    </AdminShell>
  );
}
