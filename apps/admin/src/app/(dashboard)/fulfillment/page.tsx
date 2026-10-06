import { FulfillmentManagementView } from '@/components/fulfillment/fulfillment-management-view';
import { OrderCompletionCenter } from '@/components/fulfillment/order-completion-center';
import { Badge } from '@/components/ui/badge';
import { requireAdminSession } from '@/lib/auth/session';
import { loadFulfillmentManagement } from '@/lib/fulfillment/fulfillment-data';
import { loadOrderManagement } from '@/lib/orders/orders-data';
import { loadPlatingOperations } from '@/lib/plating-operations/plating-operations-data';
import { formatAdminInteger } from '@/lib/presentation/formatters';
import { loadActiveShippingCarriers } from '@/lib/shipping/shipping-pricing-data';

export const dynamic = 'force-dynamic';

export default async function FulfillmentPage() {
  const user = await requireAdminSession({
    permissions: ['orders.read'],
    returnTo: '/fulfillment',
  });
  const canCreateShipment = user.permissions.includes('orders.tracking.write');
  const [data, orderData, platingData, carriers] = await Promise.all([
    loadFulfillmentManagement(),
    loadOrderManagement(),
    loadPlatingOperations(),
    canCreateShipment ? loadActiveShippingCarriers() : Promise.resolve([]),
  ]);

  return (
    <main className="admin-container py-6 sm:py-8 lg:py-10">
      <header className="border-b border-[var(--admin-color-border)] pb-6">
        <Badge tone="info">مرحله {formatAdminInteger(24)}</Badge>
        <h1 className="mt-3 text-2xl font-black sm:text-3xl">مرکز تکمیل سفارش‌ها</h1>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--admin-color-muted)]">
          همه مراحل آماده‌سازی، آبکاری، ساخت مرسوله، ارسال و تحویل سفارش را در یک مسیر یکپارچه انجام
          دهید.
        </p>
      </header>

      <div className="space-y-8 pt-6">
        <OrderCompletionCenter
          orders={orderData.orders}
          platingOrders={platingData.orders}
          carriers={carriers}
          failed={orderData.failed || platingData.failed}
          canUpdateStatus={user.permissions.includes('orders.status.write')}
          canCreateShipment={canCreateShipment}
          canCompletePlating={
            user.permissions.includes('orders.status.write') &&
            user.permissions.includes('finance.write')
          }
        />
        <FulfillmentManagementView queue={data.queue} summary={data.summary} failed={data.failed} />
      </div>
    </main>
  );
}
