import { ButtonLink } from '@/components/ui/button';
import { OrderManagementView } from '@/components/orders/order-management-view';
import { Badge } from '@/components/ui/badge';
import { requireAdminSession } from '@/lib/auth/session';
import { loadOrderManagement } from '@/lib/orders/orders-data';
import { formatAdminInteger } from '@/lib/presentation/formatters';

export const dynamic = 'force-dynamic';

type OrdersPageProps = Readonly<{
  searchParams: Promise<{ orderId?: string }>;
}>;

export default async function OrdersPage({ searchParams }: OrdersPageProps) {
  const user = await requireAdminSession({ permissions: ['orders.read'], returnTo: '/orders' });
  const query = await searchParams;
  const orderId =
    typeof query.orderId === 'string' &&
    /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i.test(query.orderId)
      ? query.orderId
      : undefined;
  const data = await loadOrderManagement(orderId);

  return (
    <main className="admin-container py-6 sm:py-8 lg:py-10">
      <header className="border-b border-[var(--admin-color-border)] pb-6">
        <Badge tone="info">مرحله {formatAdminInteger(16)}</Badge>
        <h1 className="mt-3 text-2xl font-black sm:text-3xl">مدیریت سفارش‌ها</h1>
        {orderId && (
          <ButtonLink href="/orders" variant="outline" size="sm" className="mt-3">
            همهٔ سفارش‌ها
          </ButtonLink>
        )}
        <p className="mt-2 max-w-2xl text-sm leading-7 text-[var(--admin-color-muted)]">
          سفارش‌ها را بررسی کنید و عملیات مجاز تغییر وضعیت، لغو و تأیید مرجوعی استثنایی را با ثبت
          کامل سابقه انجام دهید.
        </p>
      </header>

      <OrderManagementView
        orders={data.orders}
        failed={data.failed}
        canUpdateStatus={user.permissions.includes('orders.status.write')}
        canCancel={user.permissions.includes('orders.cancel')}
        initialOrderId={orderId}
      />
    </main>
  );
}
