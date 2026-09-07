import { InventoryAlertsView } from '@/components/inventory-alerts/inventory-alerts-view';
import { Badge } from '@/components/ui/badge';
import { requireAdminSession } from '@/lib/auth/session';
import { loadInventoryAlerts } from '@/lib/inventory-alerts/inventory-alerts-data';
import { formatAdminInteger } from '@/lib/presentation/formatters';

export const dynamic = 'force-dynamic';

type InventoryAlertsPageProps = Readonly<{
  searchParams: Promise<{ warehouse?: string }>;
}>;

export default async function InventoryAlertsPage({ searchParams }: InventoryAlertsPageProps) {
  await requireAdminSession({
    permissions: ['inventory.read'],
    returnTo: '/inventory-alerts',
  });
  const { warehouse } = await searchParams;
  const data = await loadInventoryAlerts(warehouse);

  return (
    <main className="admin-container py-6 sm:py-8 lg:py-10">
      <header className="border-b border-[var(--admin-color-border)] pb-6">
        <Badge tone="warning">مرحله {formatAdminInteger(12)}</Badge>
        <h1 className="mt-3 text-2xl font-black sm:text-3xl">هشدارهای موجودی</h1>
        <p className="mt-2 max-w-2xl text-sm leading-7 text-[var(--admin-color-muted)]">
          کمبودها و تقاضای ثبت‌شده مشتریان را یک‌جا ببینید و برای تأمین کالا سریع اقدام کنید.
        </p>
      </header>

      <InventoryAlertsView
        warehouses={data.inventory.warehouses}
        inventory={data.inventory.items}
        selectedWarehouseId={data.inventory.selectedWarehouseId}
        warehousesFailed={data.inventory.warehousesFailed}
        inventoryFailed={data.inventory.itemsFailed}
        notifications={data.notifications}
        notificationsFailed={data.notificationsFailed}
      />
    </main>
  );
}
