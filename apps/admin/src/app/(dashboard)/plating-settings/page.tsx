import { PlatingManagementView } from '@/components/plating/plating-management-view';
import { Badge } from '@/components/ui/badge';
import { requireAdminSession } from '@/lib/auth/session';
import { loadPlatingManagement } from '@/lib/plating/plating-data';
import { formatAdminInteger } from '@/lib/presentation/formatters';

export const dynamic = 'force-dynamic';

export default async function PlatingSettingsPage() {
  const user = await requireAdminSession({
    permissions: ['pricing.read'],
    returnTo: '/plating-settings',
  });
  const data = await loadPlatingManagement();
  return (
    <main className="admin-container py-6 sm:py-8 lg:py-10">
      <header className="border-b border-[var(--admin-color-border)] pb-6">
        <Badge tone="info">مرحله {formatAdminInteger(10)}</Badge>
        <h1 className="mt-3 text-2xl font-black sm:text-3xl">تنظیمات آبکاری محصول</h1>
        <p className="mt-2 max-w-2xl text-sm leading-7 text-[var(--admin-color-muted)]">
          نرخ، زمان آماده‌سازی، وزن مبنا و گزینه‌های آبکاری هر تنوع را مدیریت کنید.
        </p>
      </header>
      <PlatingManagementView
        rates={data.rates.data ?? []}
        variants={data.variants.data ?? []}
        ratesFailed={data.rates.failed}
        variantsFailed={data.variants.failed}
        canWritePricing={user.permissions.includes('pricing.write')}
        canWriteCatalog={user.permissions.includes('catalog.write')}
      />
    </main>
  );
}
