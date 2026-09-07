import { OrderManagementView } from '@/components/orders/order-management-view';
import { Badge } from '@/components/ui/badge';
import { requireAdminSession } from '@/lib/auth/session';
import { loadOrderManagement } from '@/lib/orders/orders-data';
import { formatAdminInteger } from '@/lib/presentation/formatters';

export const dynamic = 'force-dynamic';

export default async function OrdersPage() {
  await requireAdminSession({ permissions: ['orders.read'], returnTo: '/orders' });
  const data = await loadOrderManagement();

  return (
    <main className="admin-container py-6 sm:py-8 lg:py-10">
      <header className="border-b border-[var(--admin-color-border)] pb-6">
        <Badge tone="info">مرحله {formatAdminInteger(15)}</Badge>
        <h1 className="mt-3 text-2xl font-black sm:text-3xl">مدیریت سفارش‌ها</h1>
        <p className="mt-2 max-w-2xl text-sm leading-7 text-[var(--admin-color-muted)]">
          سفارش‌ها، اقلام، مشتری، آدرس تحویل، وضعیت پرداخت و اطلاعات ارسال را سریع بررسی کنید.
        </p>
      </header>

      <OrderManagementView orders={data.orders} failed={data.failed} />
    </main>
  );
}
