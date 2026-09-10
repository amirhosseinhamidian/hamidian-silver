import type { ReactNode } from 'react';

import { AdminShell } from '@/components/layout/admin-shell';
import { requireAdminSession } from '@/lib/auth/session';
import { getAdminNavigation } from '@/lib/navigation/admin-navigation';
import { loadAdminProfileIdentity } from '@/lib/profile/admin-profile-data';

type DashboardLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default async function DashboardLayout({ children }: DashboardLayoutProps) {
  const [user, profile] = await Promise.all([requireAdminSession(), loadAdminProfileIdentity()]);
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
      profile={profile}
    >
      {children}
    </AdminShell>
  );
}
