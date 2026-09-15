import { PricingManagementView } from '@/components/pricing/pricing-management-view';
import { Badge } from '@/components/ui/badge';
import { requireAdminSession } from '@/lib/auth/session';
import { formatAdminInteger } from '@/lib/presentation/formatters';
import { loadPricingManagement } from '@/lib/pricing/pricing-data';

export const dynamic = 'force-dynamic';

export default async function PricingPage() {
  const user = await requireAdminSession({ permissions: ['pricing.read'], returnTo: '/pricing' });
  const catalog = await loadPricingManagement();

  return (
    <main className="admin-container py-6 sm:py-8 lg:py-10">
      <header className="border-b border-[var(--admin-color-border)] pb-6">
        <Badge tone="info">مرحله {formatAdminInteger(14)}</Badge>
        <h1 className="mt-3 text-2xl font-black sm:text-3xl">مدیریت قیمت‌گذاری</h1>
        <p className="mt-2 max-w-2xl text-sm leading-7 text-[var(--admin-color-muted)]">
          قیمت فروش، تخفیف، حاشیه سود و تاریخچه تغییرات محصولات و نرخ‌های آبکاری را یکجا کنترل کنید.
        </p>
      </header>

      <PricingManagementView
        catalog={catalog.data}
        failed={catalog.failed}
        canWrite={user.permissions.includes('pricing.write')}
      />
    </main>
  );
}
