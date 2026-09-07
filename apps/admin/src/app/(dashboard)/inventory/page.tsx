import { InventoryManagementView } from '@/components/inventory/inventory-management-view';
import { Badge } from '@/components/ui/badge';
import { requireAdminSession } from '@/lib/auth/session';
import { loadInventoryManagement } from '@/lib/inventory/inventory-data';
import { formatAdminInteger } from '@/lib/presentation/formatters';

export const dynamic = 'force-dynamic';

type InventoryPageProps = Readonly<{
  searchParams: Promise<{ warehouse?: string }>;
}>;

export default async function InventoryPage({ searchParams }: InventoryPageProps) {
  const user = await requireAdminSession({
    permissions: ['inventory.read'],
    returnTo: '/inventory',
  });
  const { warehouse } = await searchParams;
  const data = await loadInventoryManagement(warehouse);

  return (
    <main className="admin-container py-6 sm:py-8 lg:py-10">
      <header className="border-b border-[var(--admin-color-border)] pb-6">
        <Badge tone="info">مرحله {formatAdminInteger(11)}</Badge>
        <h1 className="mt-3 text-2xl font-black sm:text-3xl">مدیریت انبار و موجودی</h1>
        <p className="mt-2 max-w-2xl text-sm leading-7 text-[var(--admin-color-muted)]">
          موجودی واقعی، رزروشده، قابل فروش و نقطه هشدار هر تنوع را در هر انبار کنترل کنید.
        </p>
      </header>

      <InventoryManagementView
        warehouses={data.warehouses}
        items={data.items}
        selectedWarehouseId={data.selectedWarehouseId}
        warehousesFailed={data.warehousesFailed}
        itemsFailed={data.itemsFailed}
        canWrite={user.permissions.includes('inventory.write')}
      />
    </main>
  );
}
