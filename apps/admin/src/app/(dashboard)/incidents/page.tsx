import { IncidentManagementView } from '@/components/incidents/incident-management-view';
import { Badge } from '@/components/ui/badge';
import { requireAdminSession } from '@/lib/auth/session';
import { loadOperationalIncidents } from '@/lib/incidents/incidents-data';
import { formatAdminInteger } from '@/lib/presentation/formatters';

export const dynamic = 'force-dynamic';

export default async function IncidentsPage() {
  const user = await requireAdminSession({ permissions: ['orders.read'], returnTo: '/incidents' });
  const data = await loadOperationalIncidents();

  return (
    <main className="admin-container py-6 sm:py-8 lg:py-10">
      <header className="border-b border-[var(--admin-color-border)] pb-6">
        <Badge tone="info">مرحله {formatAdminInteger(26)}</Badge>
        <h1 className="mt-3 text-2xl font-black sm:text-3xl">مدیریت رخدادها</h1>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--admin-color-muted)]">
          رخدادهای عملیاتی را از زمان تشخیص تا رفع دنبال کنید، مسئول پیگیری مشخص کنید و تصمیم‌ها را
          با یادداشت و timeline قابل حسابرسی ثبت کنید.
        </p>
      </header>

      <div className="pt-6">
        <IncidentManagementView
          incidents={data.incidents}
          failed={data.failed}
          currentUserId={user.id}
          canManage={user.permissions.includes('orders.status.write')}
        />
      </div>
    </main>
  );
}
