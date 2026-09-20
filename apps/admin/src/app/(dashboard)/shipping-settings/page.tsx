import { ShippingCarriersSettingsCard } from '@/components/shipping/shipping-carriers-settings-card';
import { Badge } from '@/components/ui/badge';
import { requireAdminSession } from '@/lib/auth/session';
import { formatAdminInteger } from '@/lib/presentation/formatters';
import { loadShippingPricingData } from '@/lib/shipping/shipping-pricing-data';

export const dynamic = 'force-dynamic';

export default async function ShippingSettingsPage() {
  const user = await requireAdminSession({
    permissions: ['settings.read'],
    returnTo: '/shipping-settings',
  });
  const data = await loadShippingPricingData();

  return (
    <main className="admin-container py-6 sm:py-8 lg:py-10">
      <header className="border-b border-[var(--admin-color-border)] pb-6">
        <Badge tone="info">مرحله {formatAdminInteger(38)}</Badge>
        <h1 className="mt-3 text-2xl font-black sm:text-3xl">تنظیمات ارسال</h1>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--admin-color-muted)]">
          شرکت‌های قابل انتخاب در checkout، هزینه و محدوده ارسال هر شرکت را مدیریت کنید.
        </p>
      </header>
      <div className="space-y-8 pt-6">
        {!data.failed ? (
          <ShippingCarriersSettingsCard
            initialCarriers={data.carriers}
            canWrite={user.permissions.includes('settings.write')}
          />
        ) : null}
      </div>
    </main>
  );
}
