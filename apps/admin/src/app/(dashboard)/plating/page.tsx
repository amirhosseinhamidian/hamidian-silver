import { PlatingOperationsView } from '@/components/plating-operations/plating-operations-view';
import { Badge } from '@/components/ui/badge';
import { requireAdminSession } from '@/lib/auth/session';
import { loadPlatingOperations } from '@/lib/plating-operations/plating-operations-data';
import { formatAdminInteger } from '@/lib/presentation/formatters';

export const dynamic = 'force-dynamic';

export default async function PlatingOperationsPage() {
  const user = await requireAdminSession({ permissions: ['orders.read'], returnTo: '/plating' });
  const data = await loadPlatingOperations();
  const canUpdateStatus = user.permissions.includes('orders.status.write');

  return (
    <main className="admin-container py-6 sm:py-8 lg:py-10">
      <header className="border-b border-[var(--admin-color-border)] pb-6">
        <Badge tone="info">مرحله {formatAdminInteger(23)}</Badge>
        <h1 className="mt-3 text-2xl font-black sm:text-3xl">صف عملیاتی آبکاری</h1>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--admin-color-muted)]">
          سفارش‌های آبکاری را براساس SLA اولویت‌بندی کنید، شروع و تکمیل کار را ثبت کنید و هزینه
          واقعی کارگاه را به دفتر هزینه سفارش منتقل کنید.
        </p>
      </header>

      <div className="pt-6">
        <PlatingOperationsView
          orders={data.orders}
          failed={data.failed}
          canOperate={canUpdateStatus}
          canComplete={canUpdateStatus && user.permissions.includes('finance.write')}
        />
      </div>
    </main>
  );
}
