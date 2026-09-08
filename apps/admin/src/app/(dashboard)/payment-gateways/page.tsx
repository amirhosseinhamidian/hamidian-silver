import { PaymentGatewaySettingsView } from '@/components/payment-gateways/payment-gateway-settings-view';
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
        <h1 className="mt-3 text-2xl font-black sm:text-3xl">تنظیم درگاه‌های پرداخت</h1>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--admin-color-muted)]">
          وضعیت زرین‌پال، زیبال و درگاه مستقیم بانک ملت را بررسی و درگاه‌های آماده را برای پرداخت
          مشتری فعال یا غیرفعال کنید.
        </p>
      </header>

      <PaymentGatewaySettingsView
        initialSettings={data.settings}
        failed={data.failed}
        canWrite={user.permissions.includes('settings.write')}
      />
    </main>
  );
}
