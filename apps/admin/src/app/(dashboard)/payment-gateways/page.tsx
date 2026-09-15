import { PaymentGatewaySettingsView } from '@/components/payment-gateways/payment-gateway-settings-view';
import { CardToCardSettingsView } from '@/components/payment-gateways/card-to-card-settings-view';
import { Badge } from '@/components/ui/badge';
import { requireAdminSession } from '@/lib/auth/session';
import { loadPaymentGatewaySettings } from '@/lib/payment-gateways/payment-gateway-data';
import { formatAdminInteger } from '@/lib/presentation/formatters';

export const dynamic = 'force-dynamic';

export default async function PaymentGatewaysPage() {
  const user = await requireAdminSession({
    permissions: ['settings.read'],
    returnTo: '/payment-gateways',
  });
  const data = await loadPaymentGatewaySettings();

  return (
    <main className="admin-container py-6 sm:py-8 lg:py-10">
      <header className="border-b border-[var(--admin-color-border)] pb-6">
        <Badge tone="info">مرحله {formatAdminInteger(18)}</Badge>
        <h1 className="mt-3 text-2xl font-black sm:text-3xl">مدیریت شیوه‌های پرداخت</h1>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--admin-color-muted)]">
          کارت‌های مقصد و درگاه‌های بانکی قابل نمایش در checkout را از یک بخش مدیریت کنید.
        </p>
      </header>

      <div className="space-y-10 pt-8">
        <CardToCardSettingsView
          initialAccounts={data.cardToCardAccounts ?? []}
          canWrite={user.permissions.includes('settings.write')}
        />
        <PaymentGatewaySettingsView
          initialSettings={data.settings}
          failed={data.failed}
          canWrite={user.permissions.includes('settings.write')}
        />
      </div>
    </main>
  );
}
