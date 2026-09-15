import { ShippingManagementView } from '@/components/shipping/shipping-management-view';
import { Badge } from '@/components/ui/badge';
import { requireAdminSession } from '@/lib/auth/session';
import { loadOrderManagement } from '@/lib/orders/orders-data';
import { formatAdminInteger } from '@/lib/presentation/formatters';
import { loadActiveShippingCarriers } from '@/lib/shipping/shipping-pricing-data';

export const dynamic = 'force-dynamic';

export default async function ShippingPage() {
  const user = await requireAdminSession({ permissions: ['orders.read'], returnTo: '/shipping' });
  const data = await loadOrderManagement();
  const carriers = user.permissions.includes('orders.tracking.write')
    ? await loadActiveShippingCarriers()
    : [];
  return (
    <main className="admin-container py-6 sm:py-8 lg:py-10">
      <header className="border-b border-[var(--admin-color-border)] pb-6">
        <Badge tone="info">مرحله {formatAdminInteger(17)}</Badge>
        <h1 className="mt-3 text-2xl font-black sm:text-3xl">مدیریت ارسال</h1>
      </header>
      <div className="pt-6">
        <ShippingManagementView
          orders={data.orders}
          failed={data.failed}
          canCreate={user.permissions.includes('orders.tracking.write')}
          canUpdateStatus={user.permissions.includes('orders.status.write')}
          carriers={carriers}
        />
      </div>
    </main>
  );
}
