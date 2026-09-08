import { FulfillmentManagementView } from '@/components/fulfillment/fulfillment-management-view';
import { Badge } from '@/components/ui/badge';
import { requireAdminSession } from '@/lib/auth/session';
import { loadFulfillmentManagement } from '@/lib/fulfillment/fulfillment-data';
import { formatAdminInteger } from '@/lib/presentation/formatters';

export const dynamic = 'force-dynamic';

export default async function FulfillmentPage() {
  await requireAdminSession({ permissions: ['orders.read'], returnTo: '/fulfillment' });
  const data = await loadFulfillmentManagement();

  return (
    <main className="admin-container py-6 sm:py-8 lg:py-10">
      <header className="border-b border-[var(--admin-color-border)] pb-6">
        <Badge tone="info">مرحله {formatAdminInteger(24)}</Badge>
        <h1 className="mt-3 text-2xl font-black sm:text-3xl">صف آماده‌سازی و ارسال</h1>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--admin-color-muted)]">
          گیت‌های پرداخت، آبکاری و ساخت مرسوله را یکجا بررسی کنید و موارد آماده، مسدود یا معوق را
          براساس اولویت به مسئول عملیات ارجاع دهید.
        </p>
      </header>

      <div className="pt-6">
        <FulfillmentManagementView queue={data.queue} summary={data.summary} failed={data.failed} />
      </div>
    </main>
  );
}
