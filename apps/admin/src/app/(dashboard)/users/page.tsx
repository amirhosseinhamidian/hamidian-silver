import { UserManagementView } from '@/components/user-management/user-management-view';
import { Badge } from '@/components/ui/badge';
import { requireAdminSession } from '@/lib/auth/session';
import { formatAdminInteger } from '@/lib/presentation/formatters';
import { loadUserManagement } from '@/lib/user-management/user-management-data';

export const dynamic = 'force-dynamic';

export default async function UsersPage() {
  const user = await requireAdminSession({ permissions: ['users.read'], returnTo: '/users' });
  const data = await loadUserManagement();
  return (
    <main className="admin-container py-6 sm:py-8 lg:py-10">
      <header className="border-b border-[var(--admin-color-border)] pb-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="info">مرحله {formatAdminInteger(34)}</Badge>
          <Badge tone="neutral">کنترل دسترسی مبتنی بر نقش</Badge>
        </div>
        <h1 className="mt-3 text-2xl font-black sm:text-3xl">کاربران و دسترسی‌ها</h1>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--admin-color-muted)]">
          وضعیت حساب، نقش‌های سیستمی، دسترسی مؤثر و نشست‌های فعال کاربران را مدیریت کنید.
        </p>
      </header>
      <div className="pt-6">
        <UserManagementView
          {...data}
          currentUserId={user.id}
          canWrite={user.permissions.includes('users.write')}
        />
      </div>
    </main>
  );
}
