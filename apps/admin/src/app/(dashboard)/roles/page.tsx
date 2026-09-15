import { RoleManagementView } from '@/components/role-management/role-management-view';
import { Badge } from '@/components/ui/badge';
import { requireAdminSession } from '@/lib/auth/session';
import { formatAdminInteger } from '@/lib/presentation/formatters';
import { loadRoleManagement } from '@/lib/role-management/role-management-data';

export const dynamic = 'force-dynamic';
export default async function RolesPage() {
  const user = await requireAdminSession({ permissions: ['users.read'], returnTo: '/roles' });
  const data = await loadRoleManagement();
  return (
    <main className="admin-container py-6 sm:py-8 lg:py-10">
      <header className="border-b border-[var(--admin-color-border)] pb-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="info">مرحله {formatAdminInteger(35)}</Badge>
          <Badge tone="neutral">کنترل دسترسی مبتنی بر نقش</Badge>
        </div>
        <h1 className="mt-3 text-2xl font-black sm:text-3xl">نقش‌ها و دسترسی‌ها</h1>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--admin-color-muted)]">
          ماتریس permissionهای سامانه را مرور کنید و دسترسی نقش عملیاتی ادمین را با کنترل‌های ایمن
          تغییر دهید.
        </p>
      </header>
      <div className="pt-6">
        <RoleManagementView
          {...data}
          canManage={user.roles.includes('MANAGER') && user.permissions.includes('users.write')}
        />
      </div>
    </main>
  );
}
