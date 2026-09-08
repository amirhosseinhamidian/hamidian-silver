import { OperationalAlertsView } from '@/components/operational-alerts/operational-alerts-view';
import { Badge } from '@/components/ui/badge';
import { requireAdminSession } from '@/lib/auth/session';
import { loadOperationalAlerts } from '@/lib/operational-alerts/operational-alerts-data';
import { formatAdminInteger } from '@/lib/presentation/formatters';

export const dynamic = 'force-dynamic';

export default async function OperationalAlertsPage() {
  const user = await requireAdminSession({ permissions: ['orders.read'], returnTo: '/alerts' });
  const data = await loadOperationalAlerts();

  return (
    <main className="admin-container py-6 sm:py-8 lg:py-10">
      <header className="border-b border-[var(--admin-color-border)] pb-6">
        <Badge tone="info">مرحله {formatAdminInteger(25)}</Badge>
        <h1 className="mt-3 text-2xl font-black sm:text-3xl">هشدارهای عملیاتی</h1>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--admin-color-muted)]">
          هشدارهای حساس آبکاری و ارسال را براساس شدت و escalation مشاهده کنید و دریافت هشدار را سریع
          و قابل حسابرسی تأیید کنید.
        </p>
      </header>

      <div className="pt-6">
        <OperationalAlertsView
          alerts={data.alerts}
          summary={data.summary}
          failed={data.failed}
          canAcknowledge={user.permissions.includes('orders.status.write')}
        />
      </div>
    </main>
  );
}
