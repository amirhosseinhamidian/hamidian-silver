import { SupplierManagementView } from '@/components/suppliers/supplier-management-view';
import { Badge } from '@/components/ui/badge';
import { requireAdminSession } from '@/lib/auth/session';
import { formatAdminInteger } from '@/lib/presentation/formatters';
import { loadSupplierManagement } from '@/lib/suppliers/suppliers-data';

export const dynamic = 'force-dynamic';

export default async function SuppliersPage() {
  const user = await requireAdminSession({
    permissions: ['pricing.read'],
    returnTo: '/suppliers',
  });
  const catalog = await loadSupplierManagement();

  return (
    <main className="admin-container py-6 sm:py-8 lg:py-10">
      <header className="border-b border-[var(--admin-color-border)] pb-6">
        <Badge tone="info">مرحله {formatAdminInteger(13)}</Badge>
        <h1 className="mt-3 text-2xl font-black sm:text-3xl">مدیریت تأمین‌کنندگان</h1>
        <p className="mt-2 max-w-2xl text-sm leading-7 text-[var(--admin-color-muted)]">
          مشخصات تأمین‌کنندگان، قیمت خرید محصولات و انتخاب منبع اصلی هر کالا را مدیریت کنید.
        </p>
      </header>

      <SupplierManagementView
        suppliers={catalog.data?.suppliers ?? []}
        products={catalog.data?.products ?? []}
        failed={catalog.failed}
        canWrite={user.permissions.includes('pricing.write')}
      />
    </main>
  );
}
